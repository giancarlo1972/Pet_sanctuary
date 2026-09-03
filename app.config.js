export default {
  expo: {
    name: "Rescue Army",
    slug: "rescue-army",
    scheme: "rescue-army",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: { supportsTablet: true },
    android: {
      adaptiveIcon: { backgroundColor: "#FF6B5B" }
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png"
    },
    plugins: ["expo-router", "expo-font", "expo-secure-store"],
    experiments: { tsconfigPaths: true }
  }
};
