<script setup lang="ts">
/**
 * `/auth` — the most guessable auth URL in the app — used to serve Tairo's
 * demo login. It told the visitor the password was `"password"`, waited four
 * seconds on a fake submit, then pushed to `/dashboards` without ever
 * authenticating, so the `auth` middleware bounced them straight back. It
 * also advertised a "14-day free trial" that Apex does not sell.
 *
 * It is a redirect now, so the natural URL reaches the real form. The four
 * sibling demos (login-2, login-3, signup-1, signup-3) were deleted outright.
 */
definePageMeta({
  redirect: '/auth/login-1',
})
</script>

<template>
  <div />
</template>
