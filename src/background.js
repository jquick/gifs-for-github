import addPermissionToggle from 'webext-permission-toggle';
import browser from 'webextension-polyfill';

// Default settings
const defaultSettings = {
  useCollapsibleGifs: false,
};

const DYNAMIC_SCRIPT_ID = 'github-gifs-dynamic';

async function updateDynamicContentScripts() {
  try {
    const permissions = await browser.permissions.getAll();
    // Filter out default origins and non-http/https
    const dynamicOrigins = (permissions.origins || []).filter(origin => {
      return !origin.includes('github.com') && 
             !origin.includes('giphy.com') &&
             origin.startsWith('http');
    });

    if (dynamicOrigins.length === 0) {
      // Unregister if exists (cleanup)
      try {
        await browser.scripting.unregisterContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
      } catch { /* ignore */ }
      return;
    }

    // Check if we need to register or update
    const registered = await browser.scripting.getRegisteredContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
    
    if (registered.length > 0) {
      await browser.scripting.updateContentScripts([{
        id: DYNAMIC_SCRIPT_ID,
        matches: dynamicOrigins
      }]);
    } else {
      await browser.scripting.registerContentScripts([{
        id: DYNAMIC_SCRIPT_ID,
        matches: dynamicOrigins,
        js: ['main.js'],
        css: ['style.css'],
        runAt: 'document_idle'
      }]);
    }
    
    // console.log('Dynamic content scripts updated for:', dynamicOrigins);
  } catch (error) {
    console.error('Failed to update dynamic content scripts:', error);
  }
}

// Listen for permission changes
browser.permissions.onAdded.addListener(updateDynamicContentScripts);
browser.permissions.onRemoved.addListener(updateDynamicContentScripts);

// Initialize context menu
async function initContextMenu() {
  const settings = await browser.storage.sync.get(defaultSettings);

  const manifest = browser.runtime.getManifest();
  const contexts = manifest.manifest_version === 2 ?
      ['browser_action'] :
      ['action'];

  // Create context menu
  browser.contextMenus.create({
    id: 'toggle-collapsible-gifs',
    title: 'Use collapsible GIFs',
    type: 'checkbox',
    checked: settings.useCollapsibleGifs,
    contexts,
  });
}

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'toggle-collapsible-gifs') {
    await browser.storage.sync.set({ useCollapsibleGifs: info.checked });
  }
});

addPermissionToggle();

// Initialize on extension install/update
browser.runtime.onInstalled.addListener(async () => {
  await initContextMenu();
  await updateDynamicContentScripts();
});
