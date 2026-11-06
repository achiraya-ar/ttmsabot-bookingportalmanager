<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/appStore'

import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ManagerLoginView from '@/views/ManagerLoginView.vue'
import ManagerDashboardView from '@/views/ManagerDashboardView.vue'
import BookingStartView from '@/views/BookingStartView.vue'
import CalendarView from '@/views/CalendarView.vue'
import SlotsView from '@/views/SlotsView.vue'
import BookingFormView from '@/views/BookingFormView.vue'
import CancellationSearchView from '@/views/CancellationSearchView.vue'
import NewPatientView from '@/views/NewPatientView.vue'
import EditPatientView from '@/views/EditPatientView.vue'

const store = useAppStore()

onMounted(() => {
  store.initialize()
})
</script>

<template>
  <div id="app-container">
    <AppHeader
      :is-manager-logged-in="store.isManagerLoggedIn"
      :user-name="store.currentUser?.full_name"
    />

    <main id="app-content">
      <Transition name="fade" mode="out-in">
        <LoadingSpinner
          v-if="store.currentView === 'loading'"
          message="กำลังเตรียมระบบผู้จัดการ..."
        />
        <ManagerLoginView     v-else-if="store.currentView === 'login'"                key="login" />
        <ManagerDashboardView v-else-if="store.currentView === 'dashboard'"            key="dashboard" />
        <BookingStartView     v-else-if="store.currentView === 'booking-start'"        key="booking-start" />
        <CalendarView         v-else-if="store.currentView === 'calendar'"             key="calendar" />
        <SlotsView            v-else-if="store.currentView === 'slots'"                key="slots" />
        <BookingFormView      v-else-if="store.currentView === 'booking-form'"         key="booking-form" />
        <CancellationSearchView v-else-if="store.currentView === 'cancellation-search'" key="cancellation-search" />
        <NewPatientView       v-else-if="store.currentView === 'new-patient'"          key="new-patient" />
        <EditPatientView      v-else-if="store.currentView === 'edit-patient'"         key="edit-patient" />
      </Transition>
    </main>

    <AppFooter />
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
