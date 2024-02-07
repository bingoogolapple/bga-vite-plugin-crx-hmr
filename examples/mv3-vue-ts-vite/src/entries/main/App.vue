<script setup lang="ts">
const chromeKeys = Object.keys(chrome)
const sandboxUrl = chrome.runtime.getURL('sandbox.html')
</script>

<template>
  <div>
    <h1>main</h1>
    <ul>
      <li v-for="item in chromeKeys" v-bind:key="item">
        {{ item }}
      </li>
    </ul>
    <iframe :src="sandboxUrl" width="400" height="400"></iframe>
  </div>
</template>

<style scoped></style>
