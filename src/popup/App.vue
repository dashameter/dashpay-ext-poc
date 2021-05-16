<template>
  <v-container>
    <dash-pay />
  </v-container>
</template>

<script>
import DashPay from "@/components/DashPay.vue";

export default {
  name: "App",
  components: { DashPay },
};
</script>

<style>
html {
  width: 400px;
  height: 400px;
}
</style>
