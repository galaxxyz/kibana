---
mapped_pages:
  - https://www.elastic.co/guide/en/kibana/current/configuration-service.html
---

# Configuration service [configuration-service]

{{kib}} provides `ConfigService` for plugin developers that want to support adjustable runtime behavior for their plugins. Plugins can only read their own configuration values, it is not possible to access the configuration values from {{kib}} Core or other plugins directly.

::::{note}
The Configuration service is only available server side.
::::


```js
// in Legacy platform
const basePath = config.get('server.basePath');
// in Kibana Platform 'basePath' belongs to the http service
const basePath = core.http.basePath.get(request);
```

To have access to your plugin config, you *should*:

* Declare plugin-specific `configPath` (will fallback to plugin `id` if not specified) in your plugin definition.
* Export schema validation for the config from plugin’s main file. Schema is mandatory. If a plugin reads from the config without schema declaration, `ConfigService` will throw an error.

**my_plugin/server/index.ts**

```typescript
import { schema, TypeOf } from '@kbn/config-schema';
export const plugin = …
export const config = {
  schema: schema.object(…),
};
export type MyPluginConfigType = TypeOf<typeof config.schema>;
```

* Read config value exposed via `PluginInitializerContext`:

**my_plugin/server/plugin.ts**

```typescript
import type { PluginInitializerContext } from '@kbn/core/server';
export class MyPlugin {
  constructor(initializerContext: PluginInitializerContext) {
    this.config$ = initializerContext.config.create<MyPluginConfigType>();
    // or if config is optional:
    this.config$ = initializerContext.config.createIfExists<MyPluginConfigType>();
  }
  ...
}
```

If your plugin also has a client-side part, you can also expose configuration properties to it using the configuration `exposeToBrowser` allow-list property.

**my_plugin/server/index.ts**

```typescript
import { schema, TypeOf } from '@kbn/config-schema';
import type { PluginConfigDescriptor } from '@kbn/core/server';

const configSchema = schema.object({
  secret: schema.string({ defaultValue: 'Only on server' }),
  uiProp: schema.string({ defaultValue: 'Accessible from client' }),
});

type ConfigType = TypeOf<typeof configSchema>;

export const config: PluginConfigDescriptor<ConfigType> = {
  exposeToBrowser: {
    uiProp: true,
  },
  schema: configSchema,
};
```

Configuration containing only the exposed properties will be then available on the client-side using the plugin’s `initializerContext`:

**my_plugin/public/index.ts**

```typescript
interface ClientConfigType {
  uiProp: string;
}

export class MyPlugin implements Plugin<PluginSetup, PluginStart> {
  constructor(private readonly initializerContext: PluginInitializerContext) {}

  public async setup(core: CoreSetup, deps: {}) {
    const config = this.initializerContext.config.get<ClientConfigType>();
  }
```

All plugins are considered enabled by default. If you want to disable your plugin, you could declare the `enabled` flag in the plugin config. This is a special {{kib}} Platform key. {{kib}} reads its value and won’t create a plugin instance if `enabled: false`.

```js
export const config = {
  schema: schema.object({ enabled: schema.boolean({ defaultValue: false }) }),
};
```

## Handle plugin configuration deprecations [handle-plugin-configuration-deprecations]

If your plugin has deprecated configuration keys, you can describe them using the `deprecations` config descriptor field. Deprecations are managed on a per-plugin basis, meaning you don’t need to specify the whole property path, but use the relative path from your plugin’s configuration root.

**my_plugin/server/index.ts**

```typescript
import { schema, TypeOf } from '@kbn/config-schema';
import type { PluginConfigDescriptor } from '@kbn/core/server';

const configSchema = schema.object({
  newProperty: schema.string({ defaultValue: 'Some string' }),
});

type ConfigType = TypeOf<typeof configSchema>;

export const config: PluginConfigDescriptor<ConfigType> = {
  schema: configSchema,
  deprecations: ({ rename, unused }) => [
    rename('oldProperty', 'newProperty'),
    unused('someUnusedProperty'),
  ],
};
```

In some cases, accessing the whole configuration for deprecations is necessary. For these edge cases, `renameFromRoot` and `unusedFromRoot` are also accessible when declaring deprecations.

**my_plugin/server/index.ts**

```typescript
export const config: PluginConfigDescriptor<ConfigType> = {
  schema: configSchema,
  deprecations: ({ renameFromRoot, unusedFromRoot }) => [
    renameFromRoot('oldplugin.property', 'myplugin.property'),
    unusedFromRoot('oldplugin.deprecated'),
  ],
};
```


## Validating your configuration based on context references [validating-your-configuration-based-on-context-references]

Some features require special configuration when running in different modes (dev/prod/dist, or even serverless). For purpose, core injects the following *references* in the validation’s context:

| Context Reference | Potential values | Description |
| --- | --- | --- |
| `dev` | `true`&#124;`false` | Is Kibana running in Dev mode? |
| `prod` | `true`&#124;`false` | Is Kibana running in Production mode (running from binary)? |
| `dist` | `true`&#124;`false` | Is Kibana running from a distributable build (not running from source)? |
| `serverless` | `true`&#124;`false` | Is Kibana running in Serverless offering? |
| `version` | `8.9.0` | The current version of Kibana |
| `buildNum` | `12345` | The build number |
| `branch` | `main` | The current branch running |
| `buildSha` | `12345` | The build SHA (typically refers to the last commit’s SHA) |
| `buildDate` | `2023-05-15T23:12:09+0000` | The ISO 8601 date of the build |

To use any of the references listed above in a config validation schema, they can be accessed via `schema.contextRef('{{CONTEXT_REFERENCE}}')`:

```js
export const config = {
  schema: schema.object({
    // Enabled by default in Dev mode
    enabled: schema.boolean({ defaultValue: schema.contextRef('dev') }),

    // Setting only allowed in the Serverless offering
    plansForWorldPeace: schema.conditional(
      schema.contextRef('serverless'),
      true,
      schema.string({ defaultValue: 'Free hugs' }),
      schema.never()
    ),
  }),
};
```

For Serverless vs. Traditional configuration, you are encouraged to use the `offeringBasedSchema` helper:

```js
import { schema, offeringBasedSchema } from '@kbn/config-schema'

export const config = {
  schema: schema.object({
    // Enabled by default in Dev mode
    enabled: schema.boolean({ defaultValue: schema.contextRef('dev') }),

    // Setting only allowed in the Serverless offering
    plansForWorldPeace: offeringBasedSchema({
      serverless: schema.string({ defaultValue: 'Free hugs' }),
    }),
  }),
};
```


