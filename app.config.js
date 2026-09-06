export default {
  expo: {
    name: "Rescue Army",
    slug: "animal-rescue-groups",
    scheme: "rescue-army",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    icon: "./assets/icon.png",
    ios: { supportsTablet: true },
    android: {
      package: "com.ruumatech.rescuearmy",
      versionCode: 12,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#1A1F3A",
      },
      permissions: ["ACCESS_FINE_LOCATION", "CAMERA", "READ_MEDIA_IMAGES"],
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png",
    },
    plugins: [
      ["expo-router", { origin: "https://rescue-army.com" }],
      "expo-font",
      "expo-web-browser",
      ["expo-build-properties", {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: "36.0.0",
        },
      }],
    ],
    experiments: { tsconfigPaths: true },
    extra: {
      eas: {
        projectId: "91f43285-0d15-4fba-b369-27e354a501bc",
      },
    },
    owner: "ruuma-tech",
  },
};
