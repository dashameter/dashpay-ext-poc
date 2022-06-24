import PortStream from "extension-port-stream";
import localforage from "localforage";
import Dash from "dash";
import Dashcore from "@dashevo/dashcore-lib";

const Identifier = require("@dashevo/dpp/lib/Identifier");

// import secp256k1 from "secp256k1";
const ECIES = require("bitcore-ecies-dash");

// const { Message } = require("@dashevo/dashcore-lib");
const Message = Dash.Core.Message;

//
// TODO: temporarily disabled for dApp development
//
// const ONBOARD_MAGIC_URL = "http://127.0.0.1:3335/#/magic";
let ONBOARD_TABID;
//
// Automagically load invite code on install
//
// chrome.runtime.onInstalled.addListener((details) => {
//   const currentVersion = chrome.runtime.getManifest().version;
//   console.log("currentVersion :>> ", currentVersion);
//   console.log("details :>> ", details);
//   chrome.tabs.create({ url: ONBOARD_MAGIC_URL, active: false }, (tab) => {
//     ONBOARD_TABID = tab.id;
//     chrome.windows.getCurrent((window) => {
//       const top = Math.max(window.top, 0) || 0;
//       const left = Math.max(window.left + (window.width - POPUP_WIDTH), 0) || 0;
//       const config = { ONBOARD_TABID: tab.id, top, left };
//       chrome.windows.create(config);
//     });
//   });
// });

const syncDashClient = async ({ mnemonic }) => {
  console.log("start syncDashClient");

  let clientOpts = {
    // unsafeOptions: {
    // skipSynchronizationBeforeHeight: 415000, // only sync from start of 2021
    // skipSynchronizationBeforeHeight: 485512,
    // },
    // passFakeAssetLockProofForTests: false,
    dapiAddresses: process.env.VUE_APP_DAPIADDRESSES
      ? JSON.parse(process.env.VUE_APP_DAPIADDRESSES)
      : undefined,

    // dapiAddresses: ["34.220.41.134", "18.236.216.191", "54.191.227.118"],
    wallet: {
      mnemonic,
    },
  };

  // Remove undefined keys from object
  clientOpts = JSON.parse(JSON.stringify(clientOpts));

  console.log("clientOpts :>> ", clientOpts);

  clientOpts.wallet.adapter = localforage;

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

  console.log("finish syncDashClient");
};

window.syncDashClient = syncDashClient;

const connectRemote = (remotePort) => {
  if (remotePort.name !== "DashPayExtension") {
    return;
  }

  const origin = remotePort.sender.origin;
  console.log("origin :>> ", origin);

  console.log("DashPay(background): connectRemote", remotePort);
  window.portStream = new PortStream(remotePort);

  const sendResponse = (name, payload) => {
    console.log("sendResponse", name, payload, Date.now());
    window.portStream.write({ name, payload, timestamp: Date.now() });
  };

  window.portStream.on("data", async (data) => {
    console.log("DashPay(background): portStream.on", data, Date.now()); //, remotePort);

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
      case "broadcastDocumentBatch":
        sendResponse(
          "onBroadcastDocumentBatch",
          await broadcastDocumentBatch(data.payload)
        );
        break;

      case "createDocument":
        sendResponse("onCreateDocument", await createDocument(data.payload));
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
        const signature = window.client.account.sign(message, idPrivateKey);

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
        console.log(
          "received unknown message :>> ",
          data.name,
          data.payload,
          Date.now()
        );
        break;
    }
  });

  chrome.storage.onChanged.addListener(function (changes, namespace) {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
      if (key === "accountDPNS") sendResponse("onConnect", newValue);
      console.log(
        `Storage key "${key}" in namespace "${namespace}" changed.`,
        `Old value was`,
        oldValue,
        ", new value is ",
        newValue,
        Date.now()
      );
    }
  });
};

chrome.runtime.onConnect.addListener(connectRemote);

const createDocument = async ({ typeLocator, document }) => {
  console.log("createDocument", document);
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

  return createdDocument;
};

const broadcastDocumentBatch = async ({ documentBatch }) => {
  const { platform } = window.client;

  console.log("documentBatch in extension background :>> ", documentBatch);

  const documentBatchCreated = {
    create: [],
    replace: [],
    delete: [],
  };

  const promises = documentBatch.create.map((document) => {
    console.log("document in promises loop :>> ", document);

    const typeLocator = `${document.$dataContractId}.${document.$type}`;

    console.log("typeLocator in promises loop:>> ", typeLocator);

    Object.keys(document).forEach(function (key) {
      key.indexOf("$") == 0 && delete document[key];
    });

    console.log("document data only :>> ", document);

    return createDocument({ typeLocator, document });
  });

  console.log("promises :>> ", promises);

  documentBatchCreated.create = await Promise.all(promises);

  console.log("documentBatchCreated.create :>> ", documentBatchCreated.create);

  const result = await platform.documents.broadcast(
    documentBatchCreated,
    window.client.myIdentity
  );

  console.log("broadcastDocumentBatch result :>> ", result);

  return result;
};

const broadcastDocument = async ({ typeLocator, document }) => {
  const { platform } = window.client;

  const [contractId] = typeLocator.split(".");

  console.log("contractId :>> ", contractId);

  const createdDocument = await createDocument({ typeLocator, document });

  const documentBatch = {
    create: [createdDocument],
    replace: [],
    delete: [],
  };

  const result = await platform.documents.broadcast(
    documentBatch,
    window.client.myIdentity
  );

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
