<template>
  <span v-if="lastSeen" class="last-seen"> last seen: {{ getTimeElapsed() }}</span>
</template>

<script>
export default {
  name: "LastSeen",
  props: {
    lastSeen: Object,
  },
  methods: {
    getTimeElapsed() {
      return this.lastSeen.fromNow()
    }
  }
};


</script>

<style scoped>
.last-seen {
  color: gray;
}
</style>