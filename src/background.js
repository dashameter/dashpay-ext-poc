import PortStream from "extension-port-stream";
import localforage from "localforage";
import Dash from "dash";
const Identifier = require("@dashevo/dpp/lib/Identifier");
import Dashcore from "@dashevo/dashcore-lib";
// import secp256k1 from "secp256k1";
const ECIES = require("bitcore-ecies-dash");

const { Message } = require("@dashevo/dashcore-lib");

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
      dpns: { contractId: "7vJjSQpo7t8B6iDDwaxa4LYi98Wu87eYcRp6E2CQNzAj" },
      example: {
        contractId: "7q6ThDPo3YtSj7WgA93JjgpVCSJ24bWFCC4pKh68zKuc",
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
      case "getConfirmedBalance":
        sendResponse(
          "onGetConfirmedBalance",
          window.client.account.getConfirmedBalance()
        );

        break;
      case "getUnusedAddress":
        sendResponse(
          "onGetUnusedAddress",
          window.client.account.getUnusedAddress()
        );

        break;

      case "signMessage": {
        console.log("signmessage :>> ", data);
        const idKey = window.client.account.identities.getIdentityHDKeyByIndex(
          0,
          0
        );
        const idPrivateKey = idKey.privateKey;
        const address = idPrivateKey.toAddress().toString();
        const message = new Message(data.payload.message);
        console.log("message :>> ", message);
        const signature = window.client.account.sign(message, idPrivateKey)
          .message;

        sendResponse("onSignMessage", {
          message: data.payload.message,
          signature,
          address,
        });
        // const verify = message.verify(idAddress, signed.toString());
        break;
      }

      case "verifyMessage": {
        const message = new Message(data.payload.message);
        const verify = message.verify(
          data.payload.address,
          data.payload.signature
        );

        sendResponse("onVerifyMessage", verify);
        break;
      }

      case "encryptForIdentityECIES": {
        console.dir(data, { depth: 100 });

        const { identities } = window.client.account;

        const HdPrivateKey = identities.getIdentityHDKeyByIndex(0, 0);

        const privateKey = HdPrivateKey.privateKey.toString();

        const { message, identity } = data.payload;

        const publicKey = identity.publicKeys[0].data;

        const recipientPublicKeyBuffer = Buffer.from(publicKey, "base64");
        console.log(`recipientPublicKeyBuffer: ${recipientPublicKeyBuffer}`);
        const recipientPublicKeyFromBuffer = new Dashcore.PublicKey(
          recipientPublicKeyBuffer
        );
        console.log(
          `recipientPublicKeyFromBuffer ${recipientPublicKeyFromBuffer}`
        );
        const signingKey = new Dashcore.PrivateKey(privateKey);

        //sender encrypts
        const sender = ECIES()
          .privateKey(signingKey)
          .publicKey(recipientPublicKeyFromBuffer);

        const encrypted = sender.encrypt(message);

        console.log("encrypted :>> ", encrypted);
        const encryptedToB64 = Buffer.from(JSON.stringify(encrypted)).toString(
          "base64"
        );

        sendResponse("onEncryptForIdentityECIES", encryptedToB64);
        break;
      }

      case "decryptForIdentityECIES": {
        console.log("decryptForIdentityECIES");
        const { identities } = window.client.account;

        const HdPrivateKey = identities.getIdentityHDKeyByIndex(0, 0);

        const privateKey = HdPrivateKey.privateKey.toString();

        const { encrypted, identity } = data.payload;

        const publicKey = identity.publicKeys[0].data;

        const senderPublicKeyBuffer = Buffer.from(publicKey, "base64");

        console.log(`senderPublicKeyBuffer: ${senderPublicKeyBuffer}`);

        const senderPublicKeyFromBuffer = new Dashcore.PublicKey(
          senderPublicKeyBuffer
        );

        console.log(`senderPublicKeyFromBuffer ${senderPublicKeyFromBuffer}`);

        const decryptingKey = new Dashcore.PrivateKey(privateKey);

        const recipient = ECIES()
          .privateKey(decryptingKey)
          .publicKey(senderPublicKeyFromBuffer);

        const toDecrypt = Buffer.from(
          JSON.parse(Buffer.from(encrypted, "base64").toString()).data
        );
        const decrypted = recipient.decrypt(toDecrypt);

        console.log(`decrypted: ${decrypted}`);

        sendResponse(
          "onDecryptForIdentityECIES",
          Buffer.from(decrypted).toString()
        );
        break;
      }

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
  const { platform } = window.client;

  const [contractId] = typeLocator.split(".");

  console.log("contractId :>> ", contractId);

  const retrievedContract = await platform.contracts.get(contractId);

  // TODO use cache, hand over apps in constructor / connect method
  window.client.getApps().set(contractId, {
    contractId: Identifier.from(contractId),
    contract: retrievedContract,
  });

  const createdDocument = await platform.documents.create(
    typeLocator,
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
