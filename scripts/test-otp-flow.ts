async function runOtpTests() {
  const baseUrl = "http://localhost:3000";
  console.log("==================================================================");
  console.log("  SUITE DE TESTS COMPLÈTE : AUTHENTIFICATION OTP RÉELLE PASMA   ");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ [RÉUSSI] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [ÉCHEC] ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // Use unique phone for test execution to avoid waiting on previous cooldowns
  const testPhone = "687" + Math.floor(100000 + Math.random() * 900000).toString();
  const testSchoolId = "ces_ekali_1";
  const testParentName = "Bene Jacques";
  const testEmail = "jacquesbene301@gmail.com";

  let generatedOtp: string | null = null;

  // TEST 1: Send Real OTP (SMS Gateway + Nodemailer Email)
  try {
    console.log("\n--- TEST 1: Expédition Réelle du Code OTP (SMS & E-mail) ---");
    const sendResp = await fetch(`${baseUrl}/api/portal/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: testSchoolId,
        parentPhone: testPhone,
        parentName: testParentName,
        parentEmail: testEmail
      })
    });
    const sendData = await sendResp.json();
    assert(sendResp.ok && sendData.success === true, "Requête d'envoi OTP acceptée par le serveur", JSON.stringify(sendData));
    assert(sendData.maskedPhone.includes("••••"), "Numéro de téléphone destinataire correctement masqué : " + sendData.maskedPhone);
    assert(Boolean(sendData.maskedEmail), "E-mail de confirmation masqué : " + sendData.maskedEmail);
    assert(sendData.attemptsLeft === 3, "Compteur de sécurité initialisé à 3 tentatives");
    assert(Boolean(sendData.testOtp), "Code OTP généré avec succès");
    
    generatedOtp = sendData.testOtp;
    console.log("   Résultat transmission :", sendData.message);
    if (sendData.emailPreviewUrl) {
      console.log("   Lien Webmail de test (Ethereal) :", sendData.emailPreviewUrl);
    }
  } catch (err: any) {
    assert(false, "Expédition OTP", err.message);
  }

  // TEST 2: Cooldown Anti-spam Protection (Rate Limiting)
  try {
    console.log("\n--- TEST 2: Contrôle Anti-spam et Temporisation (Cooldown 30s) ---");
    const spamResp = await fetch(`${baseUrl}/api/portal/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: testSchoolId,
        parentPhone: testPhone,
        parentName: testParentName
      })
    });
    const spamData = await spamResp.json();
    assert(spamResp.status === 429, "Protection 429 Too Many Requests active lors d'un renvoi immédiat");
    assert(Boolean(spamData.cooldownSeconds), `Délai de temporisation calculé : ${spamData.cooldownSeconds}s`);
  } catch (err: any) {
    assert(false, "Contrôle cooldown", err.message);
  }

  // TEST 3: Validation of Invalid OTP Code (Security rejection & decrement)
  try {
    console.log("\n--- TEST 3: Soumission d'un mauvais code OTP (Rejet de sécurité) ---");
    const wrongResp = await fetch(`${baseUrl}/api/portal/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: testSchoolId,
        parentPhone: testPhone,
        otp: "000000" // Wrong code
      })
    });
    const wrongData = await wrongResp.json();
    assert(!wrongResp.ok, "Mauvais code immédiatement rejeté");
    assert(wrongData.attemptsLeft === 2, "Compteur de tentatives décrémenté à 2", JSON.stringify(wrongData));
  } catch (err: any) {
    assert(false, "Rejet mauvais code", err.message);
  }

  // TEST 4: Validation with the Real Correct OTP Code
  try {
    console.log("\n--- TEST 4: Validation avec le vrai code OTP authentique ---");
    if (generatedOtp) {
      const validResp = await fetch(`${baseUrl}/api/portal/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: testSchoolId,
          parentPhone: testPhone,
          otp: generatedOtp
        })
      });
      const validData = await validResp.json();
      assert(validResp.ok && validData.verified === true, "Authentification OTP réussie et validée", JSON.stringify(validData));
      console.log("   Message serveur :", validData.message);
    } else {
      assert(false, "Code OTP introuvable pour le test");
    }
  } catch (err: any) {
    assert(false, "Validation vrai code OTP", err.message);
  }

  // TEST 5: Replay Attack Prevention (Code cannot be reused after verification)
  try {
    console.log("\n--- TEST 5: Protection Anti-Rejeu (Usage unique du code OTP) ---");
    if (generatedOtp) {
      const replayResp = await fetch(`${baseUrl}/api/portal/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: testSchoolId,
          parentPhone: testPhone,
          otp: generatedOtp
        })
      });
      assert(!replayResp.ok, "Re-soumission du même code bloquée (code à usage unique consommé)");
    }
  } catch (err: any) {
    assert(false, "Protection anti-rejeu", err.message);
  }

  // TEST 6: Parameter Validation on empty or malformed inputs
  try {
    console.log("\n--- TEST 6: Contrôle et validation des paramètres d'entrée ---");
    const emptyResp = await fetch(`${baseUrl}/api/portal/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolId: testSchoolId,
        parentPhone: "",
        otp: ""
      })
    });
    assert(emptyResp.status === 400, "Rejet 400 Bad Request sur champs vides");
  } catch (err: any) {
    assert(false, "Validation paramètres d'entrée", err.message);
  }

  console.log("\n==================================================================");
  console.log(`  BILAN FINAL : ${passed} TESTS RÉUSSIS / ${failed} ÉCHECS (Total: ${passed + failed})`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runOtpTests().catch(err => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
