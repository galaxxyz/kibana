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
  const retry = getService('retry');
  const kibanaServer = getService('kibanaServer');
  const { dashboard, timePicker, common } = getPageObjects(['dashboard', 'timePicker', 'common']);
  const testSubjects = getService('testSubjects');
  const esql = getService('esql');
  const dashboardAddPanel = getService('dashboardAddPanel');
  const browser = getService('browser');
  const comboBox = getService('comboBox');

  describe('dashboard - add an interval type ES|QL control', function () {
    before(async () => {
      await kibanaServer.savedObjects.cleanStandardList();
      await kibanaServer.importExport.load(
        'src/platform/test/functional/fixtures/kbn_archiver/dashboard/current/kibana'
      );
      await kibanaServer.uiSettings.replace({
        defaultIndex: '0bf35f60-3dc9-11e8-8660-4d65aa086b3c',
      });
    });

    after(async () => {
      await dashboard.navigateToApp();
      await testSubjects.click('discard-unsaved-New-Dashboard');
    });

    it('should add an ES|QL interval control', async () => {
      await dashboard.navigateToApp();
      await dashboard.clickNewDashboard();
      await timePicker.setDefaultDataRange();
      await dashboard.switchToEditMode();
      await dashboardAddPanel.clickEditorMenuButton();
      await dashboardAddPanel.clickAddNewPanelFromUIActionLink('ES|QL');
      await dashboard.waitForRenderComplete();

      await retry.try(async () => {
        const panelCount = await dashboard.getPanelCount();
        expect(panelCount).to.eql(1);
      });

      await esql.waitESQLEditorLoaded('InlineEditingESQLEditor');

      await retry.waitFor('control flyout to open', async () => {
        await esql.typeEsqlEditorQuery(
          'FROM logstash* | STATS COUNT(*) BY BUCKET(@timestamp, )',
          'InlineEditingESQLEditor'
        );
        await browser.pressKeys(browser.keys.ARROW_LEFT);
        await browser.pressKeys(browser.keys.SPACE);
        // Wait until suggestions are loaded
        await common.sleep(1000);
        // Create control is the first suggestion
        await browser.pressKeys(browser.keys.ENTER);

        return await testSubjects.exists('create_esql_control_flyout');
      });

      await comboBox.set('esqlValuesOptions', '1 hour');
      await comboBox.set('esqlValuesOptions', '1 day');

      // create the control
      await testSubjects.click('saveEsqlControlsFlyoutButton');
      await dashboard.waitForRenderComplete();

      await retry.try(async () => {
        const controlGroupVisible = await testSubjects.exists('controls-group-wrapper');
        expect(controlGroupVisible).to.be(true);
      });

      // Check Lens editor has been updated accordingly
      const editorValue = await esql.getEsqlEditorQuery();
      expect(editorValue).to.contain(
        'FROM logstash* | STATS COUNT(*) BY BUCKET(@timestamp,  ?interval)'
      );
    });
  });
}
