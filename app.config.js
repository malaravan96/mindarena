const { expo: baseConfig } = require("./app.json");

function getPluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

const profile = process.env.APP_VARIANT || process.env.EAS_BUILD_PROFILE || "production";
const isDevelopment = profile === "development";

const basePlugins = baseConfig.plugins || [];
const devClientIndex = basePlugins.findIndex(
  (plugin) => getPluginName(plugin) === "expo-dev-client"
);
const plugins = basePlugins.filter(
  (plugin) => getPluginName(plugin) !== "expo-dev-client"
);

if (isDevelopment) {
  const devClientPlugin = ["expo-dev-client", { addGeneratedScheme: true }];
  const insertAt = devClientIndex >= 0 ? devClientIndex : plugins.length;
  plugins.splice(insertAt, 0, devClientPlugin);
}

module.exports = {
  expo: {
    ...baseConfig,
    plugins,
  },
};
