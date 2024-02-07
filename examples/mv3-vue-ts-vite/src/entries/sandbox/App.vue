<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  setTimeout(() => {
    eval(`
      alert("我是 sandbox eval alert")
      `)
  }, 1000)
})
const chromeKeys = Object.keys(chrome)
</script>

<template>
  <div>
    <h1>sandbox</h1>
    <ul>
      <li v-for="item in chromeKeys" v-bind:key="item">
        {{ item }}
      </li>
    </ul>
  </div>
</template>

<style scoped></style>
