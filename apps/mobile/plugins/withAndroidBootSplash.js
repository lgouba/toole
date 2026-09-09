/**
 * Config plugin maison — splash Android via react-native-bootsplash, ANDROID UNIQUEMENT.
 *
 * Pourquoi ce plugin plutôt que le plugin Expo officiel de bootsplash :
 * le plugin officiel (`react-native-bootsplash` dans `plugins`) traite iOS ET
 * Android via `assetsDir` et ÉCHOUE au prebuild si `assets/bootsplash/ios`
 * n'existe pas. Or on ne veut PAS de bootsplash sur iOS (iOS garde son splash
 * natif « hero » plein écran via `ios.splash`). On réplique donc ici uniquement
 * les mods Android de bootsplash, avec les mêmes APIs @expo/config-plugins.
 *
 * Le module natif RNBootSplash reste autolinké par la dépendance
 * `react-native-bootsplash` (nécessaire à `useHideAnimation` côté JS).
 *
 * Assets attendus (générés par `react-native-bootsplash generate ... --platforms android`) :
 *   assets/bootsplash/android/drawable-<dpi>/bootsplash_logo.png
 *   assets/bootsplash/manifest.json  ({ background, logo })
 */
const {
  withAndroidStyles,
  withAndroidColors,
  withAndroidManifest,
  withMainActivity,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const { addImports } = require('@expo/config-plugins/build/android/codeMod');
const fs = require('node:fs');
const path = require('node:path');

const ASSETS_DIR = 'assets/bootsplash';

function readManifest(projectRoot) {
  return JSON.parse(
    fs.readFileSync(path.resolve(projectRoot, ASSETS_DIR, 'manifest.json'), 'utf8'),
  );
}

// 1) Copie les drawables générés dans android/app/src/main/res/*
const withAndroidAssets = (config) =>
  withDangerousMod(config, [
    'android',
    (c) => {
      const src = path.resolve(c.modRequest.projectRoot, ASSETS_DIR, 'android');
      if (!fs.existsSync(src)) {
        throw new Error(
          `[withAndroidBootSplash] "${src}" introuvable. Lance la génération d'assets bootsplash (--platforms android).`,
        );
      }
      const dest = path.resolve(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      for (const dir of fs.readdirSync(src)) {
        const s = path.join(src, dir);
        if (!fs.statSync(s).isDirectory()) continue;
        const d = path.join(dest, dir);
        fs.mkdirSync(d, { recursive: true });
        for (const f of fs.readdirSync(s)) {
          fs.copyFileSync(path.join(s, f), path.join(d, f));
        }
      }
      return c;
    },
  ]);

// 2) MainActivity utilise @style/BootTheme
const withManifestTheme = (config) =>
  withAndroidManifest(config, (c) => {
    c.modResults.manifest.application?.forEach((application) => {
      application.activity?.forEach((activity) => {
        if (activity.$['android:name'] === '.MainActivity') {
          activity.$['android:theme'] = '@style/BootTheme';
        }
      });
    });
    return c;
  });

// 3) RNBootSplash.init(this, R.style.BootTheme) dans MainActivity.onCreate
const withInit = (config) =>
  withMainActivity(config, (c) => {
    const { language } = c.modResults;
    const withImports = addImports(
      c.modResults.contents.replace(
        /(\/\/ )?setTheme\(R\.style\.AppTheme\)/,
        '// setTheme(R.style.AppTheme)',
      ),
      ['android.os.Bundle', 'com.zoontek.rnbootsplash.RNBootSplash'],
      language === 'java',
    );
    const merged = mergeContents({
      src: withImports,
      comment: '    //',
      tag: 'bootsplash-init',
      offset: 0,
      anchor: /super\.onCreate\((null|savedInstanceState)\)/,
      newSrc: '    RNBootSplash.init(this, R.style.BootTheme)' + (language === 'java' ? ';' : ''),
    });
    c.modResults.contents = merged.contents;
    return c;
  });

// 4) Couleur de fond du splash
const withColors = (config) =>
  withAndroidColors(config, (c) => {
    const { background } = readManifest(c.modRequest.projectRoot);
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, {
      name: 'bootsplash_background',
      value: background,
    });
    return c;
  });

// 5) Style BootTheme (parent EdgeToEdge : l'app est en edge-to-edge)
const withStyles = (config) =>
  withAndroidStyles(config, (c) => {
    const { resources } = c.modResults;
    const style = resources.style ?? [];
    const item = [
      { $: { name: 'postBootSplashTheme' }, _: '@style/AppTheme' },
      { $: { name: 'bootSplashBackground' }, _: '@color/bootsplash_background' },
      { $: { name: 'bootSplashLogo' }, _: '@drawable/bootsplash_logo' },
    ];
    resources.style = [
      ...style.filter((s) => s.$.name !== 'BootTheme'),
      { $: { name: 'BootTheme', parent: 'Theme.BootSplash.EdgeToEdge' }, item },
    ];
    return c;
  });

module.exports = function withAndroidBootSplash(config) {
  config = withAndroidAssets(config);
  config = withColors(config);
  config = withStyles(config);
  config = withManifestTheme(config);
  config = withInit(config);
  return config;
};
