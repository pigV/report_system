import { createApp } from 'vue';
import App from './App.vue';
import { YiiEditorPlugin } from '@yiitap/vue';
import '@yiitap/vue/dist/vue.css';
import './style.css';
import './clinical-workspace.css';
import './free-template/native-template.css';
// Keep application overrides after the editor and legacy workspace styles.
import './reference-theme.css';
import './report-workbench.css';
createApp(App).use(YiiEditorPlugin).mount('#root');
