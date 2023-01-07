<template>
  <i class="icon" :class="{ connected: connected }"></i>
</template>

<script>
export default {
  name: "StatusIcon",
  props: {
    connected: Boolean,
  },
};
</script>

<style scoped>
.icon {
  height: 8px;
  width: 8px;
  border-radius: 50%;
  display: inline-block;
  background-color: #e38968;
  margin-right: 6px;
}

.icon.connected {
  background-color: #86bb71;
}
</style>
