function getIconPath(isInactive: boolean) {
  return isInactive
    ? {
        16: `icon-16-gray.png`,
        24: `icon-24-gray.png`,
        32: `icon-32-gray.png`,
        48: `icon-48-gray.png`,
        96: `icon-96-gray.png`,
        128: `icon-128-gray.png`,
      }
    : {
        16: `icon-16.png`,
        24: `icon-24.png`,
        32: `icon-32.png`,
        48: `icon-48.png`,
        96: `icon-96.png`,
        128: `icon-128.png`,
      };
}

export function setActiveIcon() {
  chrome.action.setIcon({ path: getIconPath(false) });
}

export function setInactiveIcon() {
  chrome.action.setIcon({ path: getIconPath(true) });
}
