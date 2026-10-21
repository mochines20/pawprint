module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin must be last (Reanimated 4: 'react-native-worklets/plugin')
    plugins: ['react-native-worklets/plugin'],
  };
};
