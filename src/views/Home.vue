<template>
  <v-container>
    <dash-pay />
  </v-container>
</template>

<script>
// @ is an alias to /src
import DashPay from "@/components/DashPay.vue";

export default {
  name: "Home",
  components: {
    DashPay,
  },
};
</script>
