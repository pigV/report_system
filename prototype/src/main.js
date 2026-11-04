// 【学习01】应用入口；对照 docs/report-demo-guide.md 第 2、3、6 节。
// createApp 创建 Vue 应用，use 注册 Yiitap 插件，mount 把 App 组件挂到 HTML 的 #root。
// 组件负责界面；编辑器实例的命令、文档和选区仍由 Tiptap / ProseMirror 管理。
import { createApp } from 'vue';
import App from './App.vue';
import { YiiEditorPlugin } from '@yiitap/vue';
// 先引入编辑器默认样式，再引入项目样式；覆盖关系与导入顺序有关。
import '@yiitap/vue/dist/vue.css';
import './style.css';
import './clinical-workspace.css';
import './free-template/native-template.css';
// Keep application overrides after the editor and legacy workspace styles.
import './reference-theme.css';
import './report-workbench.css';
import './readable-type.css';
createApp(App).use(YiiEditorPlugin).mount('#root');
