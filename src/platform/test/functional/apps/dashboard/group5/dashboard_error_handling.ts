/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../ftr_provider_context';

export default function ({ getService, getPageObjects }: FtrProviderContext) {
  const { dashboard, header } = getPageObjects(['dashboard', 'header']);
  const kibanaServer = getService('kibanaServer');
  const testSubjects = getService('testSubjects');
  const filterBar = getService('filterBar');

  /**
   * Common test suite for testing exception scenarious within dashboard
   */
  describe('dashboard error handling', () => {
    before(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
      await kibanaServer.importExport.load(
        'src/platform/test/functional/fixtures/kbn_archiver/dashboard/current/kibana'
      );
      // The kbn_archiver above was created from an es_archiver which intentionally had
      // 2 missing index patterns.  But that would fail to load with kbn_archiver.
      // So we unload those 2 index patterns here.
      await kibanaServer.importExport.unload(
        'src/platform/test/functional/fixtures/kbn_archiver/dashboard/current/kibana_unload'
      );
      await kibanaServer.importExport.load(
        'src/platform/test/functional/fixtures/kbn_archiver/dashboard_error_cases.json'
      );
      await dashboard.navigateToApp();
    });

    after(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
    });

    it('correctly loads default index pattern on first load with an error embeddable', async () => {
      await dashboard.gotoDashboardLandingPage();
      await dashboard.loadSavedDashboard('Dashboard with Missing Lens Panel');
      await header.waitUntilLoadingHasFinished();
      await filterBar.addFilter({ field: 'bytes', operation: 'is', value: '12345678' });
      await header.waitUntilLoadingHasFinished();
      expect(await filterBar.getFilterCount()).to.be(1);
    });

    // wrapping into own describe to make sure new tab is cleaned up even if test failed
    // see: https://github.com/elastic/kibana/pull/67280#discussion_r430528122
    describe('when the saved object is missing', () => {
      it('shows the missing data view error message', async () => {
        await dashboard.gotoDashboardLandingPage();
        await dashboard.loadSavedDashboard('dashboard with missing index pattern');
        await header.waitUntilLoadingHasFinished();
        const embeddableError = await testSubjects.find('embeddableError');
        const errorMessage = await embeddableError.getVisibleText();

        expect(errorMessage).to.contain('Could not locate that data view');
      });
    });
  });
}
