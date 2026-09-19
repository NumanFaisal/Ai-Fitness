const fs = require('fs');
const path = require('path');

const gradleFile = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

if (!fs.existsSync(gradleFile)) {
  console.log('android/app/build.gradle not found at ' + gradleFile);
  process.exit(0);
}

let content = fs.readFileSync(gradleFile, 'utf8');

const storePass = process.env.KEYSTORE_PASSWORD || 'fitness123';
const keyAlias = process.env.KEY_ALIAS || 'ai-fitness-key';
const keyPass = process.env.KEY_PASSWORD || 'fitness123';

const releaseSigning = `
        release {
            if (file('release.keystore').exists()) {
                storeFile file('release.keystore')
                storePassword '${storePass}'
                keyAlias '${keyAlias}'
                keyPassword '${keyPass}'
            }
        }
`;

if (!content.includes('signingConfigs.release')) {
  content = content.replace(/signingConfigs\s*\{/, `signingConfigs {${releaseSigning}`);
  content = content.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.\w+/, '$1signingConfigs.release');
  fs.writeFileSync(gradleFile, content, 'utf8');
  console.log('Successfully configured release signing in android/app/build.gradle');
} else {
  console.log('Release signing already configured in build.gradle');
}
