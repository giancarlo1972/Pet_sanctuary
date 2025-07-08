export default {
  expo: {
    name: "Pet Sanctuary",
    slug: "pet-sanctuary",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "petsanctuary",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.petsanctuary.app",
      buildNumber: "1"
    },
    android: {
      package: "com.petsanctuary.app",
      versionCode: 1
    },
    web: {
      bundler: "metro",
      output: "server",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router", 
      "expo-font", 
      "expo-web-browser",
      [
        "expo-router",
        {
          "origin": process.env.EXPO_PUBLIC_WEBSITE_URL || false
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      }
    }
  }
};