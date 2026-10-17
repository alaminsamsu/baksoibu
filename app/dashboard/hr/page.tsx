if (userRole === 'HR') {
  router.push('/dashboard/hr'); // Langsung ke dashboard khusus HR
} else if (userRole === 'OWNER') {
  router.push('/dashboard/executive');
}