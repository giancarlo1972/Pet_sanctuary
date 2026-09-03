export default {
  expo: {
    name: "Rescue Army",
    slug: "rescue-army",
    scheme: "rescue-army",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    ios: { supportsTablet: true },
    android: {
      adaptiveIcon: { backgroundColor: "#FF6B5B" }
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: null
    },
    plugins: ["expo-router", "expo-font"],
    experiments: { tsconfigPaths: true }
  }
};
