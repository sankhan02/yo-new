<template>
    <section>
      <h2>useAppKit</h2>
      <pre>
Address: {{ accountInfo.address }}
caip Address: {{ accountInfo.caipAddress }}
Connected: {{ accountInfo.isConnected }}
Status: {{ accountInfo.status }}
      </pre>
    </section>

    <section>
      <h2>Theme</h2>
      <pre>
Theme: {{ kitTheme.themeMode }}
      </pre>
    </section>

    <section>
      <h2>State</h2>
      <pre>
open: {{ state.open }}
selectedNetworkId: {{ state.selectedNetworkId }}
      </pre>
    </section>

    <section>
      <h2>WalletInfo</h2>
      <pre>
Name: {{ walletInfo }}<br />
      </pre>
    </section>

    <section>
      <h2>SIWX Session</h2>
      <div><b>Signature:</b> <span style="word-break:break-all">{{ siwxSession?.signature || '-' }}</span></div>
      <div><b>Status:</b> {{ siwxSession?.status || '-' }}</div>
      <div><b>Nonce:</b> {{ siwxSession?.nonce || '-' }}</div>
    </section>
</template>
  
<script >
import { onMounted } from "vue";
import {
  useAppKitState,
  useAppKitTheme,
  useAppKitEvents,
  useAppKitAccount,
  useWalletInfo,
} from "@reown/appkit/vue";

export default {
  name: "InfoList",
  props: {
    siwxSession: {
      type: Object,
      required: false,
      default() { return {}; },
    },
  },
  setup(props){
    const kitTheme = useAppKitTheme();
    const state = useAppKitState();
    const accountInfo = useAppKitAccount();
    const events = useAppKitEvents();
    const { walletInfo } = useWalletInfo();

    onMounted(() => {
      console.log("Events: ", events);
    });

    return {
      kitTheme,
      state,
      accountInfo,
      walletInfo,
      siwxSession: props.siwxSession
    };
  },
};
</script>