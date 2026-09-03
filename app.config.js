export default {
  expo: {
    name: "Rescue Army",
    slug: "rescue-army",
    scheme: "rescue-army",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    icon: "./assets/icon.png",
    ios: { supportsTablet: true },
    android: {
      adaptiveIcon: { backgroundColor: "#FF6B5B" }
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png"
    },
    plugins: [["expo-router", { origin: "https://rescue-army.app" }], "expo-font"],
    experiments: { tsconfigPaths: true }
  }
};
