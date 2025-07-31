// Script para limpiar sesiones almacenadas en localStorage
// Ejecutar en la consola del navegador

console.log('Limpiando sesiones almacenadas...');

// Limpiar localStorage
localStorage.removeItem('user');
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');

console.log('Sesiones limpiadas. Recarga la página para ver los cambios.');

// Opcional: recargar la página
// window.location.reload(); 