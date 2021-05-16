<template>
  <div>
    <v-card style="text-align: center">
      <v-card-title class="center"
        ><v-img
          max-height="40px"
          max-width="40px"
          src="icons/150.png"
          style="margin-right: 12px"
        />
        DashPay</v-card-title
      >
      <v-card-text class="text-center"
        >Your invite code is:<strong>
          {{ inviteCode || "N/A" }}</strong
        ></v-card-text
      >
      <v-textarea outlined v-model="mnemonic"></v-textarea>
      <v-row
        align="center"
        justify="center"
        style="text-align: center; padding-bottom: 12px"
        ><v-spacer>
          <v-btn :loading="isSyncingDashClient" @click="login" class="pl-4"
            >Login</v-btn
          ></v-spacer
        >
      </v-row>
    </v-card>
  </div>
</template>

<script>
var background = chrome.extension.getBackgroundPage();
// console.log("background :>> ", background);
// let client = background.client;
// let syncDashClient = background.syncDashClient;

export default {
  name: "DashPay",
  data: function () {
    return {
      inviteCode: "",
      isSyncingDashClient: false,
      mnemonic:
        "sun ocean mimic tennis beef vapor list make broccoli pill equal field",
    };
  },
  created() {
    const that = this;
    console.log(
      "chrome.extension.getURL(icons/150.png) :>> ",
      chrome.extension.getURL("icons/150.png")
    );
    chrome.storage.local.set({ accountDPNS: null }, function () {
      console.log("Value is set to ", "null");
    });
    chrome.storage.local.get(["inviteCode"], function (result) {
      console.log("inviteCode is ", result.inviteCode);
      that.inviteCode = result.inviteCode;
    });
  },
  mounted() {
    const that = this;
    chrome.storage.local.get(["counter"], function (result) {
      console.log("Value currently is " + result.counter);
      that.value = result.counter | 0;
      console.log("this.value mounted:>> ", that.value);
    });
    this.login();
  },
  methods: {
    async login() {
      this.isSyncingDashClient = true;

      try {
        await background.syncDashClient({ mnemonic: this.mnemonic });

        const receivingAddress = background.client.account.getUnusedAddress()
          .address;

        console.log("receivingAddress :>> ", receivingAddress);

        const accountDPNS = (
          await background.client.platform.names.resolveByRecord(
            "dashUniqueIdentityId",
            background.client.myIdentityId
          )
        )[0].toJSON();

        console.log("accountDPNS :>> ", accountDPNS);

        chrome.tabs.getCurrent(function (tab) {
          chrome.tabs.remove(tab.id, function () {});
        });

        chrome.storage.local.set({ accountDPNS }, function () {
          console.log("Value is set to ", accountDPNS);
        });
      } catch (e) {
        alert(e.message);
        console.error(e);
      }

      this.isSyncingDashClient = false;
    },
  },
};
</script>

<style scoped>
p {
  font-size: 20px;
}
.center {
  display: flex;
  justify-content: center;
  margin-left: auto;
  margin-right: auto;
  width: 50%;
}
</style>
