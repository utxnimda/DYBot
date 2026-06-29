import type { Component } from "vue";
import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

createApp(App as Component).mount("#app");
