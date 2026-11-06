<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useAppStore } from "@/stores/appStore";
import { getDashboardStats } from "@/services/api";
import { animateCounter } from "@/utils/dateUtils";
import Swal from "sweetalert2";

const store = useAppStore();

const statsLoaded = ref(false);
const statsError = ref(false);

onMounted(async () => {
    try {
        const { data, error } = await getDashboardStats();
        if (error) throw error;
        if (data) {
            statsLoaded.value = true;
            // Wait for DOM to update before animating
            setTimeout(() => {
                const monthlyEl = document.getElementById("monthly-counter");
                const totalEl = document.getElementById("total-counter");
                if (monthlyEl) animateCounter(monthlyEl, data.monthlyBookings);
                if (totalEl) animateCounter(totalEl, data.totalBookings);
            }, 50);
        }
    } catch (err) {
        console.error("Could not load dashboard stats:", err);
        statsError.value = true;
    }
});

async function handleLogout() {
    await store.logout();
    store.navigateTo("login");
    Swal.fire({
        icon: "info",
        title: "ออกจากระบบ",
        text: "คุณได้ออกจากโหมดผู้จัดการแล้ว",
        timer: 1500,
        showConfirmButton: false,
    });
}

function goToNewBooking() {
    store.navigateTo("booking-start");
}

function goToCancellationSearch() {
    store.navigateTo("cancellation-search");
}

function goToNewPatient() {
    store.navigateTo("new-patient");
}

function goToEditPatient() {
    store.navigateTo("edit-patient");
}
</script>

<template>
    <div class="manager-dashboard">
        <!-- Dashboard Header -->
        <div
            class="dashboard-header"
            style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 2rem;
                flex-wrap: wrap;
                gap: 1rem;
            "
        >
            <h2
                class="page-title"
                style="border: none; margin: 0; font-size: 1.5rem"
            >
                <i class="fa-solid fa-user-shield"></i> หน้าสำหรับผู้จัดการ
            </h2>
            <button class="btn btn-secondary" @click="handleLogout">
                <i class="fa-solid fa-right-from-bracket"></i> ออกจากระบบ
            </button>
        </div>

        <!-- Action Cards -->
        <div class="home-actions">
            <a
                href="#"
                class="btn-home-action btn-home-action--outline"
                @click.prevent="goToNewBooking"
            >
                <div class="action-icon">
                    <i class="fa-solid fa-calendar-plus"></i>
                </div>
                <div class="action-text">
                    <span>จองคิวให้ผู้ป่วย</span>
                    <small>ค้นหาผู้ป่วยและจองคิวใหม่</small>
                </div>
            </a>

            <a
                href="#"
                class="btn-home-action btn-home-action--outline"
                @click.prevent="goToCancellationSearch"
            >
                <div class="action-icon">
                    <i class="fa-solid fa-magnifying-glass"></i>
                </div>
                <div class="action-text">
                    <span>ตรวจสอบ/ยกเลิกคิว</span>
                    <small>ค้นหาด้วยเลขบัตรประชาชน</small>
                </div>
            </a>

            <a
                href="#"
                class="btn-home-action btn-home-action--outline"
                @click.prevent="goToNewPatient"
            >
                <div class="action-icon">
                    <i class="fa-solid fa-user-plus"></i>
                </div>
                <div class="action-text">
                    <span>ลงทะเบียนผู้ป่วยใหม่</span>
                    <small>เพิ่มข้อมูลผู้ป่วยในระบบ</small>
                </div>
            </a>

            <a
                href="#"
                class="btn-home-action btn-home-action--outline"
                @click.prevent="goToEditPatient"
            >
                <div class="action-icon">
                    <i class="fa-solid fa-user-pen"></i>
                </div>
                <div class="action-text">
                    <span>แก้ไขข้อมูลผู้ป่วย</span>
                    <small>ค้นหา แก้ไข หรือลบข้อมูล</small>
                </div>
            </a>
        </div>

        <!-- Stats Bar -->
        <div class="subtle-stats-bar">
            <!-- Loading state -->
            <span v-if="!statsLoaded && !statsError" class="loading-text">
                <i class="fas fa-spinner fa-spin"></i> กำลังโหลดสถิติ...
            </span>

            <!-- Error state -->
            <span v-else-if="statsError" class="loading-text">
                ไม่สามารถโหลดสถิติได้
            </span>

            <!-- Loaded state -->
            <template v-else>
                <span class="stat-group">
                    <i class="fa-solid fa-calendar-check"></i>
                    จองคิวเดือนนี้:
                    <span id="monthly-counter" class="stat-number">0</span>
                    ครั้ง
                </span>
                <span class="stat-divider">|</span>
                <span class="stat-group">
                    <i class="fa-solid fa-chart-line"></i>
                    จำนวนการจองคิวสะสม:
                    <span id="total-counter" class="stat-number">0</span> ครั้ง
                </span>
            </template>
        </div>
    </div>
</template>
