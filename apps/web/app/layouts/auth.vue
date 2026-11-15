<template>
  <div class="flex min-h-dvh flex-col bg-muted">
    <header class="flex items-center justify-between p-4">
      <AppLogo />
      <div class="flex items-center gap-1">
        <AppLanguageSwitcher />
        <AppThemeSwitcher />
      </div>
    </header>
    <main class="flex flex-1 items-center justify-center px-4 pb-16">
      <div class="w-full max-w-sm"><slot /></div>
    </main>
  </div>
</template>
