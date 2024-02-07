<script setup lang="ts">
const testSandbox = async () => {
  let url = chrome.runtime.getURL('main.html')
  await chrome.tabs.create({ url })
}

const chromeKeys = Object.keys(chrome)
</script>

<template>
  <div>
    <h1>newtab</h1>
    <ul>
      <li v-for="item in chromeKeys" v-bind:key="item">
        {{ item }}
      </li>
    </ul>
    <button @click="testSandbox">打开 main.html 测试 sandbox.html</button>
  </div>
</template>

<style scoped></style>
