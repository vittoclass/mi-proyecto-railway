export function tplBienvenidaGratis({ email }: { email: string }) {
  return `<h2>🎓 Bienvenido/a a LibelIA (Plan Gratuito)</h2>
  <p>Hola ${email}, ya tienes tus créditos de prueba activos.</p>
  <p>Empieza aquí: <a href="${process.env.APP_PUBLIC_URL}/evaluar">${process.env.APP_PUBLIC_URL}/evaluar</a></p>`;
}

export function tplCompraOK({ email, plan, creditos, facturaUrl }:{
  email:string; plan:string; creditos:number; facturaUrl?:string
}) {
  return `<h2>✅ Compra confirmada</h2>
  <p>Hola ${email}, activamos tu plan <b>${plan}</b>.</p>
  <p>Créditos cargados: <b>${creditos}</b></p>
  ${facturaUrl ? `<p>Comprobante: <a href="${facturaUrl}">Descargar</a></p>` : ""}
  <p>Ir a evaluar: <a href="${process.env.APP_PUBLIC_URL}/evaluar">${process.env.APP_PUBLIC_URL}/evaluar</a></p>`;
}

export function tplResultado({ email, titulo, nota, enlacePDF }:{
  email:string; titulo:string; nota?:string; enlacePDF?:string
}) {
  return `<h2>📄 Resultado disponible: ${titulo}</h2>
  ${nota ? `<p>Nota/score: <b>${nota}</b></p>` : ""}
  ${enlacePDF ? `<p>Informe: <a href="${enlacePDF}">Abrir PDF</a></p>` : ""}
  <p>Historial: <a href="${process.env.APP_PUBLIC_URL}/historial">${process.env.APP_PUBLIC_URL}/historial</a></p>`;
}
