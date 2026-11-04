<script setup>
// 【学习07】影像多选的 Vue 部分：只维护勾选顺序并发出 insert，不在组件里 dispatch。
// 真正的文档结构和事务见 editor/key-image-insert.mjs；对照指南第 7.5 节。
import {computed,ref} from 'vue';
import {PhCheck} from '@phosphor-icons/vue';
import {keyImages} from '../key-images.mjs';
import {keyImageGrid} from '../editor/key-image-insert.mjs';
defineProps({insideColumn:Boolean});
const emit=defineEmits(['insert','close']);
const selected=ref([]),active=ref(0);
// computed 让提示中的行列数随勾选自动变化；四张 2×2、六张 2×3，其余单行。
const grid=computed(()=>keyImageGrid(selected.value.length));
// 新选择放数组末尾，因此插图按选择顺序；取消后重选也会移到最后。
function toggle(id){selected.value=selected.value.includes(id)?selected.value.filter(value=>value!==id):[...selected.value,id]}
// 克隆数组再发事件，避免外部逻辑持有 selected 的同一个可变数组引用。
function insert(){if(selected.value.length)emit('insert',[...selected.value])}
function onKeyDown(event){
  // active 是键盘高亮索引，selected 才是最终多选结果；移动高亮不会自动勾选。
  // Footer controls keep their native Space/Enter activation when tab-focused.
  if(event.target?.closest?.('footer')&&!['Escape','ArrowLeft'].includes(event.key))return false;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    active.value=(active.value+(event.key==='ArrowDown'?1:-1)+keyImages.length)%keyImages.length;
  }else if(event.key===' '){toggle(keyImages[active.value].id)}
  else if(event.key==='Enter'){insert()}
  else if(event.key==='ArrowLeft'||event.key==='Escape'){emit('close')}
  else return false;
  event.preventDefault();event.stopPropagation();return true;
}
// SlashMenu 从 suggestion 生命周期接键盘事件，再经组件 ref 调用这里暴露的方法。
defineExpose({onKeyDown});
</script>
<template>
  <section class="key-image-picker" aria-label="选择关键影像" @mousedown.prevent @keydown="onKeyDown">
    <header><strong>关键影像</strong><span>支持多选</span></header>
    <div class="key-image-options" role="group" aria-label="关键影像列表">
      <button v-for="(image,i) in keyImages" :key="image.id" type="button" role="checkbox" :aria-checked="selected.includes(image.id)" :aria-label="image.name" :class="{checked:selected.includes(image.id),'keyboard-active':active===i}" @mouseenter="active=i" @focus="active=i" @click="toggle(image.id)">
        <span class="key-image-check"><PhCheck v-if="selected.includes(image.id)" :size="12" weight="bold"/></span>
        <img :src="image.src" :alt="image.name" draggable="false"/>
        <span class="key-image-copy"><strong>{{image.name}}</strong><small>{{image.detail}}</small></span>
      </button>
      <p v-if="!keyImages.length" class="key-image-empty">暂无关键影像</p>
    </div>
    <footer><span aria-live="polite">已选 {{selected.length}} 张<span v-if="selected.length"> · {{insideColumn?'插入当前栏':grid.rows===1?`将生成 ${grid.columns} 列`:`将生成 ${grid.rows} 行 × ${grid.columns} 列`}}</span></span><button type="button" class="key-image-clear" :disabled="!selected.length" @click="selected=[]">清空</button><button type="button" class="key-image-insert" :disabled="!selected.length" @click="insert">插入 {{selected.length}} 张</button></footer>
    <p class="key-image-help">↑ ↓ 选择 · 空格勾选 · Enter 插入</p>
  </section>
</template>
<style>
.key-image-picker{box-sizing:border-box;width:340px;max-width:calc(100vw - 16px);padding:12px;background:#fff;border:1px solid #dfe4e5;border-radius:7px;box-shadow:0 7px 24px #152d3024;color:#30383a;font:13px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}
.key-image-picker header{display:flex;align-items:center;justify-content:space-between;margin:0 2px 10px}.key-image-picker header strong{font-size:14px}.key-image-picker header span{font-size:11px;color:#7a8387}
.key-image-options{max-height:min(310px,45vh);overflow:auto;display:grid;gap:4px}.key-image-options>button{display:flex;align-items:center;gap:10px;width:100%;border:1px solid transparent;border-radius:4px;background:#fff;padding:8px;text-align:left;color:inherit;cursor:pointer}.key-image-options>button.checked{background:#e9f4f2}.key-image-options>button:hover,.key-image-options>button.keyboard-active{border-color:#9bc2bd}.key-image-options img{width:52px;height:58px;object-fit:contain;background:#10191d;border-radius:3px}.key-image-check{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:16px;height:16px;border:1px solid #b9c3c3;border-radius:3px;color:#fff}.checked .key-image-check{border-color:#16796e;background:#16796e}.key-image-copy{display:grid;gap:5px}.key-image-copy strong{font-size:13px;font-weight:600}.key-image-copy small{font-size:11px;color:#748083}
.key-image-picker footer{display:flex;align-items:center;gap:8px;border-top:1px solid #e8ecec;margin-top:10px;padding-top:11px;white-space:nowrap}.key-image-picker footer>span{flex:1;font-size:11px}.key-image-picker footer button{border:0;border-radius:4px;font:inherit;cursor:pointer}.key-image-clear{background:transparent;color:#788285;padding:6px 0;font-size:11px!important}.key-image-insert{background:#13766b;color:white;padding:7px 10px;font-weight:600!important}.key-image-insert:hover{background:#0c6259}.key-image-picker button:disabled{opacity:.4;cursor:default}.key-image-help{font-size:10px;color:#929b9e;margin:8px 2px 0}.key-image-empty{padding:20px;text-align:center;color:#858f92}
</style>
