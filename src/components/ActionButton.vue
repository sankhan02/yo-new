<template>
  <div>
    <button @click="openAppKit">Open</button>
    <button @click="handleDisconnect">Disconnect</button>
    <button @click="switchToNetwork">Switch</button>
  </div>
</template>

<script>
import { useDisconnect, useAppKit, useAppKitNetwork } from "@reown/appkit/vue";
import { solana, solanaDevnet } from "@reown/appkit/networks";

export default {
  name: "ActionButtonList",
  setup() {
    const { disconnect } = useDisconnect();
    const { open } = useAppKit();
    const networkData = useAppKitNetwork();

    const openAppKit = () => open();
    const switchToNetwork = () => networkData.value.switchNetwork(solanaDevnet);
    const handleDisconnect = async () => {
        try {
          await disconnect();
        } catch (error) {
          console.error("Error during disconnect:", error);
        }
    };


    return {
      handleDisconnect,
      openAppKit,
      switchToNetwork,
    };
  },
};
</script>
