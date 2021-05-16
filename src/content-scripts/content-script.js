import PortStream from "extension-port-stream";
import LocalMessageDuplexStream from "post-message-stream";

async function start() {
  await setupStreams();
  await domIsReady();
}

start();

/**
 * Sets up two-way communication streams between the
 * browser extension and local per-page browser context.
 */
async function setupStreams() {
  const pageStream = new LocalMessageDuplexStream({
    name: "DashPay:content",
    target: "DashPay:Dapp",
  });

  const extensionPort = chrome.runtime.connect({
    name: "DashPayExtension",
  });

  const extensionStream = new PortStream(extensionPort);

  extensionStream.pipe(pageStream);
  pageStream.pipe(extensionStream);
}

/**
 * Returns a promise that resolves when the DOM is loaded (does not wait for images to load)
 */
function domIsReady() {
  // already loaded
  if (["interactive", "complete"].includes(document.readyState)) {
    return Promise.resolve();
  }

  // wait for load
  return new Promise((resolve) =>
    window.addEventListener("DOMContentLoaded", resolve, { once: true })
  );
}

// // chrome.runtime.sendMessage({ type: "get-user-data" }, (response) => {
// // console.log("received user data", response);
// // });

// /*
// Bridge messages from Dapp to DashPay Extension
// */
// window.addEventListener("message", (event) => {
//   if (
//     event.source == window &&
//     event.data &&
//     event.data.direction == "fromDapp"
//   ) {
//     chrome.runtime.sendMessage(
//       {
//         type: "request-access",
//         viewportwidth: document.documentElement.clientWidth,
//       },
//       (response) => {
//         alert(response);
//       }
//     );
//   }
// });

// /*
// Bridge messages from DasyPay extension to Dapp
// */
// chrome.runtime.onMessage.addListener((message, sender) => {
//   console.error("from DashPay to Content Script", message, sender);
//   alert("from dashpay to content script" + message);
//   window.postMessage(
//     {
//       direction: "fromDashPay",
//       data: message,
//     },
//     "*"
//   );
// });
