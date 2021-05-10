import PortStream from "extension-port-stream";
import localforage from "localforage";
import Dash from "dash";

const ONBOARD_MAGIC_URL = "http://127.0.0.1:3335/#/magic";
let ONBOARD_TABID;

chrome.runtime.onInstalled.addListener((details) => {
  const currentVersion = chrome.runtime.getManifest().version;
  console.log("currentVersion :>> ", currentVersion);
  console.log("details :>> ", details);
  chrome.tabs.create({ url: ONBOARD_MAGIC_URL, active: false }, (tab) => {
    ONBOARD_TABID = tab.id;
    chrome.windows.getCurrent((window) => {
      const top = Math.max(window.top, 0) || 0;
      const left = Math.max(window.left + (window.width - POPUP_WIDTH), 0) || 0;

      const config = { ONBOARD_TABID: tab.id, top, left };
      chrome.windows.create(config);
    });
  });
});

// eslint-disable-next-line no-unused-vars
const syncDashClient = async ({ mnemonic }) => {
  console.log("start syncDashClient");

  let clientOpts = {
    unsafeOptions: {
      // skipSynchronizationBeforeHeight: 415000, // only sync from start of 2021
      // skipSynchronizationBeforeHeight: 485512,
    },
    passFakeAssetLockProofForTests: false,
    dapiAddresses: ["127.0.0.1:3000"],
    // dapiAddresses: ["34.220.41.134", "18.236.216.191", "54.191.227.118"],
    wallet: {
      mnemonic,
      adapter: localforage,
    },
    apps: {
      dpns: { contractId: "3Z5gfAU5tqVuAZipj2ugjKsgdNDYa4SgHqzwoWZAenbA" },
      example: {
        contractId: "9njaPq8fFwCXoMn9Q15LdMZiTwgrrBsaRzMMUgXpkLfw",
        // contractId: "7y6p6RUpzk9PTj77DBQXr2CaC1gLgFKYhiE3W3Sgo3T1",
      },
    },
  };

  console.log("clientOpts :>> ", clientOpts);

  window.client = new Dash.Client(clientOpts);

  console.log("client :>> ", window.client);

  window.client.account = await window.client.getWalletAccount();

  console.log("client.account :>> ", window.client.account);

  window.client.myIdentityId = window.client.account.identities.getIdentityIds()[0];

  console.log("client.myIdentityId :>> ", window.client.myIdentityId);

  window.client.myIdentity = await window.client.platform.identities.get(
    window.client.myIdentityId
  );

  console.log("client.myIdentity :>> ", window.client.myIdentity);

  // window.client = client;

  console.log("finish syncDashClient");
};

window.syncDashClient = syncDashClient;

// syncDashClient();
const connectRemote = (remotePort) => {
  if (remotePort.name !== "DashPayExtension") {
    return;
  }

  const origin = remotePort.sender.origin;
  console.log("origin :>> ", origin);

  console.log("DashPay(background): connectRemote", remotePort);
  window.portStream = new PortStream(remotePort);

  const sendResponse = (name, payload) => {
    window.portStream.write({ name, payload });
  };

  window.portStream.on("data", async (data) => {
    console.log("DashPay(background): portStream.on", data); //, remotePort);

    switch (data.name) {
      case "connect":
        openPopup();

        break;

      case "broadcastDocument":
        sendResponse(
          "onBroadcastDocument",
          await broadcastDocument(data.payload)
        );

        break;

      case "inviteCode":
        chrome.storage.local.set({ inviteCode: data.payload }, function () {
          console.log("The inviteCode is set to:", data.payload);
          ONBOARD_TABID && chrome.tabs.remove(ONBOARD_TABID);
          openPopup();
        });

        break;

      default:
        console.log("received message :>> ", data.name, data.payload);
        break;
    }
  });

  chrome.storage.onChanged.addListener(function (changes, namespace) {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
      sendResponse("onConnect", newValue);
      console.log(
        `Storage key "${key}" in namespace "${namespace}" changed.`,
        `Old value was "${oldValue}", new value is "${newValue}".`
      );
    }
  });
};

chrome.runtime.onConnect.addListener(connectRemote);

// eslint-disable-next-line no-unused-vars
const broadcastDocument = async ({ typeLocator, document }) => {
  const platform = window.client.platform;

  const createdDocument = await platform.documents.create(
    "example.example", // FIXME typeLocator
    window.client.myIdentity,
    document
  );

  console.log("created document :>> ", createdDocument);

  const documentBatch = {
    create: [createdDocument],
    replace: [],
    delete: [],
  };

  const result = await platform.documents.broadcast(
    documentBatch,
    window.client.myIdentity
  );

  console.log("broadcastDocument result :>> ", result);
  return result;
};

const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 640;
/* popup */
// TODO: Actions such as transaction rejection if user closes a popup
let tabId = undefined;
chrome.tabs.onRemoved.addListener(() => (tabId = undefined));
const openPopup = () => {
  const popup = {
    type: "popup",
    focused: true,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
  };
  console.log("popup :>> ", popup);
  console.log("tabId :>> ", tabId);
  console.log(
    '{ url: chrome.chrome.getURL("popup.html"), active: false } :>> ',
    { url: chrome.extension.getURL("popup.html"), active: false }
  );
  !tabId &&
    chrome.tabs.create(
      { url: chrome.extension.getURL("popup.html"), active: false },
      (tab) => {
        tabId = tab.id;
        chrome.windows.getCurrent((window) => {
          const top = Math.max(window.top, 0) || 0;
          const left =
            Math.max(window.left + (window.width - POPUP_WIDTH), 0) || 0;

          const config = { ...popup, tabId: tab.id, top, left };
          chrome.windows.create(config);
        });
      }
    );
};

// const closePopup = () => {
//   tabId && chrome.tabs.remove(tabId);
// };
