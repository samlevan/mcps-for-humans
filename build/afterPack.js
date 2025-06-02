const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
  if (process.platform !== 'darwin') {
    return;
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productName}.app`);
  
  console.log('Cleaning extended attributes from app bundle...');
  
  try {
    // Remove extended attributes from the entire app bundle
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
    console.log('Successfully cleaned extended attributes');
  } catch (error) {
    console.error('Failed to clean extended attributes:', error);
  }
};