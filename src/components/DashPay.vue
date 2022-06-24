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
      <v-row>
        <v-col v-for="(testUser, idx) in testUsers" :key="idx">
          <v-btn text @click="mnemonic = testUser.mnemonic">
            {{ testUser.name }}</v-btn
          >
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <input
            type="checkbox"
            id="useAutoLogin"
            name="useAutoLogin"
            v-model="useAutoLogin"
          />
          <label for="useAutoLogin">Auto-Login</label>
        </v-col>
      </v-row>
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: "DashPay",
  data: function () {
    return {
      useAutoLogin: false,
      testUsers: [
        {
          name: "Alice",
          mnemonic:
            "access glad stomach deal tray entire mean grunt boy shoot want shrimp",
        },
        {
          name: "Bob",
          mnemonic:
            "proud group frequent erase retire approve produce race wealth picnic alert pear",
        },
      ],
      inviteCode: "",
      isSyncingDashClient: false,
      mnemonic: "",
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
  async mounted() {
    const that = this;

    chrome.storage.local.get(["testMnemonic"], function (result) {
      console.log("result.testMnemonic :>> ", result.testMnemonic);
      that.mnemonic = result.testMnemonic || that.testUsers[0].mnemonic;
    });

    chrome.storage.local.get(["useAutoLogin"], function (result) {
      that.useAutoLogin = result.useAutoLogin;
    });

    await sleep(150);

    if (that.useAutoLogin) that.login();
  },
  watch: {
    mnemonic: function () {
      this.setMnemonic();
    },
    useAutoLogin: function () {
      this.setUseAutoLogin();
    },
  },
  methods: {
    // async setMnemonic(testUserMnemonic) {
    //   this.mnemonic = testUserMnemonic;
    //   this.syncSettings();
    // },
    async setMnemonic() {
      console.log("setMnemonic", this.mnemonic);

      chrome.storage.local.set({ testMnemonic: this.mnemonic });
    },
    async setUseAutoLogin() {
      chrome.storage.local.set({
        useAutoLogin: this.useAutoLogin,
      });
    },
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
          tab && tab.id && chrome.tabs.remove(tab.id, function () {});
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
