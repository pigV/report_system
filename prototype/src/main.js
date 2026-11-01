import { createApp } from 'vue';
import App from './App.vue';
import { YiiEditorPlugin } from '@yiitap/vue';
import '@yiitap/vue/dist/vue.css';
import './style.css';
import './clinical-workspace.css';
import './free-template/native-template.css';
createApp(App).use(YiiEditorPlugin).mount('#root');
