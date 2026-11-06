<script setup lang="ts">
const model = defineModel<boolean>({ required: true })

withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)
</script>

<template>
  <div class="self-book-toggle" :class="{ 'is-disabled': disabled }">
    <div class="self-book-toggle__text">
      <span class="self-book-toggle__label">
        อนุญาตให้ผู้ป่วยจองคิวเองผ่านหน้าเว็บ
      </span>
      <span class="self-book-toggle__hint">
        เปิดเพื่อให้ผู้ป่วยจองคิวเองได้ / ปิดเพื่อให้เจ้าหน้าที่จองให้เท่านั้น
      </span>
    </div>
    <div class="self-book-toggle__control">
      <span
        class="self-book-toggle__state"
        :class="{ 'is-on': model }"
      >
        {{ model ? 'เปิด' : 'ปิด' }}
      </span>
      <button
        type="button"
        role="switch"
        :aria-checked="model"
        aria-label="อนุญาตให้ผู้ป่วยจองคิวเองผ่านหน้าเว็บ"
        :disabled="disabled"
        class="self-book-toggle__switch"
        :class="{ 'is-on': model }"
        @click="model = !model"
      >
        <span class="self-book-toggle__thumb"></span>
      </button>
    </div>
  </div>
</template>
