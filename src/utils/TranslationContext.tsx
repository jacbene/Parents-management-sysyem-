import React, { createContext, useContext, useState, useEffect } from 'react';

export type LanguageType = 'fr' | 'en';

interface TranslationContextType {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
  isAutoDetected: boolean;
}

const translations: Record<LanguageType, Record<string, string>> = {
  fr: {
    // Nav Tabs & General labels
    'tab.apee_dashboard': 'Tableau de bord',
    'tab.apee_recording': 'Saisie Cotisation',
    'tab.apee_search': 'Recherche & Reçus',
    'tab.apee_reporting': 'Synthèse & Rapports',
    'tab.apee_finance': 'Dépenses & Recettes',
    'tab.apee_archives': 'Historique & Logs',
    'tab.apee_settings': 'Paramètres APEE',
    'tab.apee_reminders': 'Relances SMS & Email',
    'tab.apee_legal': 'Mentions Légales',
    'tab.announcements': 'Annonces',
    'tab.homework': 'Cahier de textes',
    'tab.grades': 'Notes & Bulletins',
    'tab.attendance': 'Présences',
    'tab.billing': 'Facturation',
    'tab.appointments': 'Rendez-vous',
    'tab.messages': 'Messagerie',

    // Global UI Header / Controls
    'header.school_portal': 'Portail de l\'Établissement',
    'header.logout': 'Se déconnecter',
    'header.offline': 'Mode Hors-ligne activé',
    'header.online': 'En ligne',
    'header.welcome': 'Bienvenue',
    'header.select_lang': 'Langue',
    'header.role.manager': 'Gestionnaire',
    'header.role.parent': 'Espace Parent',
    'header.exit': 'Quitter le portail',
    'header.change_school': "Changer d'école",

    // Dashboard Screen
    'dash.title': 'Indicateurs Financiers & Pilotage',
    'dash.subtitle': 'Aperçu global en temps réel des encaissements des cotisations de l\'établissement.',
    'dash.stats.expected_recette': 'Recette Prévue Globale',
    'dash.stats.collected_recette': 'Frais Totaux Encaissés',
    'dash.stats.unpaid_recette': 'Reste à Recouvrer',
    'dash.stats.rate_recette': 'Taux de Recouvrement',
    'dash.stats.expected_students': 'Effectif Attendu',
    'dash.stats.registered_parents': 'Foyers Parents Créés',
    'dash.stats.actual_students': 'Pupilles Enregistrées',
    'dash.stats.other_revenues': 'Autres Recettes (Dons...)',
    'dash.panels.recent_payments': 'Derniers Versements Parents',
    'dash.panels.recent_expenses': 'Flux de Trésorerie Récents',
    'dash.alerts.unpaid_parents': 'Alerte Solvabilité Foyers',
    'dash.alerts.unpaid_desc': 'Liste des foyers parents accusant un retard ou versement partiel',
    'dash.empty': 'Aucun versement n\'a encore été enregistré pour cette année scolaire.',
    'dash.expense.spent': 'Dépenses Totales',
    'dash.expense.balance': 'Solde en Caisse',
    'dash.quick_actions': 'Actions Rapides',
    'dash.action.add_parent': 'Enregistrer un Parent',
    'dash.action.add_expense': 'Saisir une Dépense',

    // Form / Saisie Page
    'form.title': 'Gestion des Foyers & Encaissement Direct',
    'form.subtitle': 'Formulaire d\'enrôlement des parents d\'élèves, gestion des pupilles, et encaissement en temps réel.',
    'form.parent_info': '👤 Informations d\'En-Tête Foyer (Responsable)',
    'form.parent_name_label': 'Nom complet du Parent / Tuteur',
    'form.parent_name_placeholder': 'Ex: MBARGA Jean-Pierre',
    'form.parent_phone_label': 'Téléphone de contact direct',
    'form.parent_phone_placeholder': 'Ex: 6XXXXXXXX',
    'form.parent_address_label': 'Quartier / Adresse de résidence',
    'form.parent_address_placeholder': 'Ex: Bastos, Yaoundé',
    'form.parent_email_label': 'Adresse Email (Optionnelle)',
    'form.parent_email_placeholder': 'Ex: jean.pierre@gmail.com',
    'form.pupils_section': '👧 Élèves & Pupilles Rattachés au Foyer',
    'form.pupils_desc': 'Veuillez lister ci-dessous tous les élèves sous la responsabilité de ce parent.',
    'form.pupil_name': 'Nom complet de l\'élève',
    'form.pupil_class': 'Classe d\'affectation',
    'form.pupil_dob': 'Date de Naissance',
    'form.add_pupil_btn': 'Ajouter un élève / pupille',
    'form.remove_chk': 'Enlever',
    'form.payment_section': '💵 Formulaire de Règlement & Encaissement',
    'form.payment_desc': 'Enregistrer un paiement ou acompte immédiat pour ce dossier.',
    'form.deposit_amount': 'Montant Déposé',
    'form.payment_method': 'Méthode de Paiement',
    'form.payment_method.cash': 'Espèces / Manuel',
    'form.payment_method.mobile': 'Mobile Money (MTN / Orange)',
    'form.payment_method.wave': 'Wave / Autre Portefeuille',
    'form.payment_method.bank': 'Virement / Versement Bancaire',
    'form.transaction_id': 'ID Transaction / Référence',
    'form.transaction_placeholder': 'Numéro de reçu ou ID opérateur...',
    'form.payment_note': 'Mémo / Notes de Trésorerie',
    'form.payment_note_placeholder': 'Ex: Premier acompte de scolarité',
    'form.sms_notify': '🔔 Générer un SMS automatique de confirmation',
    'form.save_btn': 'Enregistrer & Valider le Dossier Foyer',
    'form.edit_btn': 'Mettre à jour le Dossier Foyer',
    'form.success_save': 'Foyer parent enregistré avec succès !',
    'form.success_update': 'Foyer parent mis à jour avec succès !',
    
    // Search / Receipts Page
    'search.title': 'Annuaire des Parents & Service des Reçus',
    'search.subtitle': 'Rechercher un parent, imprimer un reçu sécurisé, gérer l\'historique des versements.',
    'search.placeholder': 'Rechercher par nom de parent, nom d\'élève ou n° de téléphone...',
    'search.filter_status': 'Statut Cotisation',
    'search.filter_all': 'Tous les statuts',
    'search.filter_paid': 'Soldé (Intégral)',
    'search.filter_partial': 'Partiel (Acompte)',
    'search.filter_late': 'En Retard (Aucun versement)',
    'search.parent_details': '📁 Fiche Foyer Spécifique',
    'search.print_receipt': 'Imprimer le Reçu de Caisse (PDF)',
    'search.print_desc': 'Génération d\'un document PDF officiel APEE avec entête officiel.',
    'search.last_reminder': 'Dernière relance envoyée le :',
    'search.never_reminded': 'Aucune relance envoyée',
    'search.parent_record': 'Dossier Financier du Foyer',
    'search.payment_history': 'Historique Chronologique des Versements',
    'search.delete_parent': 'Supprimer ce Foyer',
    'search.delete_confirm': 'Êtes-vous sûr de vouloir supprimer ce parent ? Cette action supprimera définitivement ses pupilles et ses règlements.',

    // Financial / Expense Page
    'fin.title': 'Grille de Trésorerie Globale (Flux Budgétaires)',
    'fin.subtitle': 'Saisie et répartition des dépenses d\'exploitation de l\'APEE, gestion des dons et subventions externes.',
    'fin.stats.receipts': 'Encaissements (Revenus)',
    'fin.stats.expenses': 'Dépenses validées',
    'fin.stats.cash_in_hand': 'Solde Réel en Caisse',
    'fin.add_expense': 'Saisie d\'une Dépense / Décaissement',
    'fin.expense_title': 'Objet de la dépense / Motif',
    'fin.expense_title_placeholder': 'Ex: Achat de craies blanches et effaçeurs',
    'fin.expense_amount': 'Montant de la dépense d\'exploitation',
    'fin.expense_type': 'Type de Justificatif',
    'fin.expense_type.command': 'Bon de commande',
    'fin.expense_type.payment': 'Ordre de paiement direct',
    'fin.expense_type.refund': 'Remboursement de frais',
    'fin.expense_budget_line': 'Rubrique Budgétaire concernée',
    'fin.expense_desc': 'Description détaillée / Destinataire ou prestataire',
    'fin.expense_save': 'Enregistrer la dépense',
    'fin.expense_success': 'Dépense enregistrée avec succès !',
    'fin.list_expenses': 'Registre des dépenses d\'exploitation',
    'fin.list_other_revenues': 'Registre des Autres Entrées (Hors Foyer)',
    'fin.add_revenue': 'Saisie Entrée Complémentaire',
    'fin.revenue.name': 'Nom de l\'institution / Donateur',
    'fin.revenue.type': 'Qualité du Donateur',
    'fin.revenue.type.honor': 'Membre d\'honneur/Bienfaiteur',
    'fin.revenue.type.inst': 'Institution/Organisme tiers',
    'fin.revenue.type.other': 'Autre source de recette',

    // Reporting Page
    'rep.title': 'Bilan Financier & Analyse Économique',
    'rep.subtitle': 'Rapports consolidés pour les Assemblées Générales et audit des comptes de l\'APEE.',
    'rep.bud_gauge': 'Jauge Globale de Recouvrement des Cotisations',
    'rep.bud_evolution': 'Évolution Mensuelle des Encaissements',
    'rep.bud_allocation': 'Rapprochement Réel : Dépenses vs Lignes Budgétaires',
    'rep.bud_desc': 'Distribution des fonds par lignes d\'allocation. La ligne rouge représente la limite budgétaire allouée.',
    'rep.export_excel': 'Exporter Bilan au format CSV',

    // Reminders Page
    'rem.title': 'Campagnes de Relance Multicanal (SMS & Mail)',
    'rem.subtitle': 'Informer les tuteurs en retard de cotisation et suivre l\'efficience opérationnelle.',
    'rem.stats.unsold': 'Nombre de parents ciblés (Dette > 0)',
    'rem.stats.sms_sent': 'Rapports SMS envoyés',
    'rem.stats.email_sent': 'Rapports Email expédiés',
    'rem.campaign': '🚀 Configurer & Lancer une Relance Groupée',
    'rem.subject': 'Sujet du Message / Libellé de Relance',
    'rem.body': 'Gabarit de Corps du Message (Utiliser {parent} et {amount})',
    'rem.send_sms': 'Envoyer la Relance Groupée par SMS',
    'rem.send_email': 'Expédier la Campagne d\'Emails',
    'rem.notify.success': 'Campagne de relance envoyée avec succès !',

    // Settings Page
    'set.title': 'Configuration de l\'Établissement & Comptes',
    'set.subtitle': 'Personnaliser l\'entité APEE active, paramétrer les mot de passe responsables et les enveloppes budgétaires.',
    'set.info_general': '🏢 Informations Générales de la structure',
    'set.name': 'Nom de la structure / Association Active',
    'set.short': 'Sigle usuel (ex: APEE, AP, PTA)',
    'set.year': 'Année Scolaire en cours',
    'set.country': 'Pays de l\'Établissement',
    'set.currency': 'Devise monétaire de gestion',
    'set.expected_students': 'Volume total d\'élèves attendus',
    'set.honor_expected': 'Budget prévisionnel (Membres d\'honneur)',
    'set.aid_expected': 'Subventions attendues',
    'set.save_settings': 'Enregistrer l\'ensemble des configurations',
    'set.budget_lines': '📊 Découpage de l\'Enveloppe des Dépenses (Lignes Budgétaires)',
    'set.obligations': '💳 Définir les Obligations Financières Obligatoires',
    'set.obligation_add': 'Ajouter une Rubrique d\'Obligation Financière',
    'set.passwords': '🔒 Clés d\'Autorisation Administrateur & Coffre-fort',
    'set.passwords_desc': 'Définir des mots de passe différents pour isoler les actions financières et académiques.',
    'set.fin_manager': 'Responsable Administratif / Financier',
    'set.ped_manager': 'Inspecteur des Études / Censeur Académique',
    'set.notify.success': 'Modifications enregistrées !',

    // Database & Backup section in settings
    'set.db_management': '💾 Sauvegardes, Export & Nettoyage de Base',
    'set.db_desc': 'Toutes les données sont stockées au format local et synchronisées sur Firebase Firestore.',
    'set.export': 'Exporter la Base complète (JSON)',
    'set.import': 'Restaurer une Base via Fichier JSON',
    'set.reset': 'Vider la Base active (DANGER)',
    'set.reset_warn': '🚨 Attention, cette action effacera définitivement tous les parents, versements, budget et dépenses enregistrés !',
    
    // Messages / Inbox Module translations
    'msg.console_admin': "Console d'échange de l'administration et des professeurs titulaires avec les familles.",
    'msg.console_parent': "Échangez directement avec les professeurs principaux et l'administration scolaire.",
    'msg.active_session': "Session active :",
    'msg.role_admin': "🏫 Administration / Enseignants",
    'msg.role_parent': "👤 Espace Parent",
    'msg.search_placeholder': "Élève, parent, ou téléphone...",
    'msg.all_classes': "Toutes les classes ({count})",
    'msg.filter_active': "Membres actifs",
    'msg.search_parent': "Rechercher un tuteur...",
    'msg.referents': "Responsables Référents",
    'msg.contact_direct': "Contact Direct :",
    'msg.no_messages': "Aucun message échangé pour le moment.",
    'msg.send_as': "Émettre en tant que :",
    'msg.contact_official': "Contacter l'officiel :",
    'msg.back': "Retour",
    'msg.teacher': "Professeur Principal",
    'msg.censor': "Censeur / Surveillant Général",
    'msg.director': "Directeur / Proviseur",
    'msg.call': "Appeler",
    'msg.write_to_parent': "Écrire au parent de {name}...",
    'msg.write_to_teacher': "Écrire au professeur principal de {name} ({teacher})...",
    'msg.write_to_censor': "Écrire au Censeur & Surveillant général des élèves ({censor})...",
    'msg.write_to_director': "Écrire au Directeur & Proviseur de l'établissement ({director})...",
  },
  en: {
    // Nav Tabs & General labels
    'tab.apee_dashboard': 'Dashboard',
    'tab.apee_recording': 'Record Payment',
    'tab.apee_search': 'Search & Receipts',
    'tab.apee_reporting': 'Reports & Analytics',
    'tab.apee_finance': 'Expenses & Revenues',
    'tab.apee_archives': 'Logs & History',
    'tab.apee_settings': 'PTA Settings',
    'tab.apee_reminders': 'SMS & Email Reminders',
    'tab.apee_legal': 'Legal Notices',
    'tab.announcements': 'Announcements',
    'tab.homework': 'Homework Board',
    'tab.grades': 'Grades & Reports',
    'tab.attendance': 'Attendance',
    'tab.billing': 'Billing Portal',
    'tab.appointments': 'Appointments',
    'tab.messages': 'Messages',

    // Global UI Header / Controls
    'header.school_portal': 'School Portal',
    'header.logout': 'Sign Out',
    'header.offline': 'Offline Mode active',
    'header.online': 'Online',
    'header.welcome': 'Welcome',
    'header.select_lang': 'Language',
    'header.role.manager': 'Administrator',
    'header.role.parent': 'Parent Area',
    'header.exit': 'Exit Portal',
    'header.change_school': 'Change School',

    // Dashboard Screen
    'dash.title': 'Financial Analytics & Pilot Dashboard',
    'dash.subtitle': 'Real-time overview of PTA contributions and financial flows in your school.',
    'dash.stats.expected_recette': 'Forecast Budget Goal',
    'dash.stats.collected_recette': 'Total Fees Collected',
    'dash.stats.unpaid_recette': 'Remaining Dues',
    'dash.stats.rate_recette': 'Collection Rate',
    'dash.stats.expected_students': 'Target Student Count',
    'dash.stats.registered_parents': 'Parent Households',
    'dash.stats.actual_students': 'Enrolled Pupils',
    'dash.stats.other_revenues': 'Other Incomes (Donations)',
    'dash.panels.recent_payments': 'Recent Parent Collections',
    'dash.panels.recent_expenses': 'Recent Financial Outflows',
    'dash.alerts.unpaid_parents': 'Household Solvency Alerts',
    'dash.alerts.unpaid_desc': 'List of parent accounts with dues remaining',
    'dash.empty': 'No payments have been recorded yet for this school year.',
    'dash.expense.spent': 'Total Outflows',
    'dash.expense.balance': 'Cash in Box',
    'dash.quick_actions': 'Quick Actions',
    'dash.action.add_parent': 'Register Parent',
    'dash.action.add_expense': 'Record Expense',

    // Form / Saisie Page
    'form.title': 'Household Registration & Direct Payment Collection',
    'form.subtitle': 'Enroll parent accounts, manage assigned pupils, and collect dues in real-time.',
    'form.parent_info': '👤 Parent Household Profile (Main Contact)',
    'form.parent_name_label': 'Parent / Guardian Full Name',
    'form.parent_name_placeholder': 'E.g. MBARGA Jean-Pierre',
    'form.parent_phone_label': 'Direct Contact Phone Number',
    'form.parent_phone_placeholder': 'E.g. 6XXXXXXXX',
    'form.parent_address_label': 'Neighborhood / Home Address',
    'form.parent_address_placeholder': 'E.g. Bastos, Yaoundé',
    'form.parent_email_label': 'Email Address (Optional)',
    'form.parent_email_placeholder': 'E.g. jean.pierre@gmail.com',
    'form.pupils_section': '👧 Assigned Students & Pupils',
    'form.pupils_desc': 'Register below all children associated with this parent household.',
    'form.pupil_name': 'Full name of pupil',
    'form.pupil_class': 'Assigned classroom',
    'form.pupil_dob': 'Date of Birth',
    'form.add_pupil_btn': 'Assign new student / pupil',
    'form.remove_chk': 'Remove',
    'form.payment_section': '💵 Contribution Payment Form',
    'form.payment_desc': 'Instantly record a payment or down payment for this account.',
    'form.deposit_amount': 'Deposited Amount',
    'form.payment_method': 'Payment Mode',
    'form.payment_method.cash': 'Cash / Manual',
    'form.payment_method.mobile': 'Mobile Money (MTN / Orange)',
    'form.payment_method.wave': 'Wave / Other Wallet',
    'form.payment_method.bank': 'Bank Transfer / Deposit',
    'form.transaction_id': 'Transaction ID / Reference',
    'form.transaction_placeholder': 'Receipt number or network reference ID...',
    'form.payment_note': 'Memo / Cashier Notes',
    'form.payment_note_placeholder': 'E.g. First partial installment',
    'form.sms_notify': '🔔 Generate automated SMS receipt confirmation',
    'form.save_btn': 'Register & Commit Parent Profile',
    'form.edit_btn': 'Update Parent Profile',
    'form.success_save': 'Parent household recorded successfully!',
    'form.success_update': 'Parent household updated successfully!',

    // Search / Receipts Page
    'search.title': 'Parent Directory & Receipt Desk',
    'search.subtitle': 'Lookup parents, print audited cash receipts, monitor historical payments.',
    'search.placeholder': 'Search by parent name, pupil name, or phone...',
    'search.filter_status': 'Dues Status',
    'search.filter_all': 'All Accounts',
    'search.filter_paid': 'Fully Settled',
    'search.filter_partial': 'Partial Payment',
    'search.filter_late': 'In Arrears (No payment)',
    'search.parent_details': '📁 Specific Household Statement',
    'search.print_receipt': 'Generate Cash Receipt (PDF)',
    'search.print_desc': 'Generates an official school PTA receipt with automated breakdowns.',
    'search.last_reminder': 'Last reminder dispatched on:',
    'search.never_reminded': 'Never contacted yet',
    'search.parent_record': 'Household Financial Register',
    'search.payment_history': 'Chronological Payments ledger',
    'search.delete_parent': 'Delete Parent Profile',
    'search.delete_confirm': 'Are you sure you want to delete this parent? This action will permanently wipe their students and payments.',

    // Financial / Expense Page
    'fin.title': 'Cashflow & Balance Sheets (Outflows & Direct Inflows)',
    'fin.subtitle': 'Record and categorize PTA operational expenses, manage external grants and donations.',
    'fin.stats.receipts': 'Direct PTA Revenues',
    'fin.stats.expenses': 'Audited Outflows',
    'fin.stats.cash_in_hand': 'Actual Box Balance',
    'fin.add_expense': 'Record Cash Outflow / Expense',
    'fin.expense_title': 'Expense Purpose / Label',
    'fin.expense_title_placeholder': 'E.g. Chalk blocks purchase',
    'fin.expense_amount': 'Operational disbursement amount',
    'fin.expense_type': 'Voucher Type',
    'fin.expense_type.command': 'Order voucher / Invoice',
    'fin.expense_type.payment': 'Direct Payment order',
    'fin.expense_type.refund': 'Expense Reimbursement',
    'fin.expense_budget_line': 'Target Budget Line Allocation',
    'fin.expense_desc': 'Detailed Description / Provider references',
    'fin.expense_save': 'Record Outflow',
    'fin.expense_success': 'Expense booked successfully!',
    'fin.list_expenses': 'Operational Expense Ledger',
    'fin.list_other_revenues': 'Direct Revenues Ledger (Extra Inflow)',
    'fin.add_revenue': 'Record Alternative Revenue',
    'fin.revenue.name': 'Sponsor / Organization Name',
    'fin.revenue.type': 'Sponsor Category',
    'fin.revenue.type.honor': 'Honorary Member/Donor',
    'fin.revenue.type.inst': 'Institutional partner',
    'fin.revenue.type.other': 'Other revenue source',

    // Reporting Page
    'rep.title': 'Financial Statements & Audits',
    'rep.subtitle': 'Consolidated balance reports for Board General Assemblies and audits.',
    'rep.bud_gauge': 'Overall PTA Contributions Collection Gauge',
    'rep.bud_evolution': 'Monthly Collections Progress Ledger',
    'rep.bud_allocation': 'Actual Alignment: Outflows vs Budget Allocations',
    'rep.bud_desc': 'Funds distribution across allocation lines. The red line marks the authorized budget envelope.',
    'rep.export_excel': 'Export Balance Sheets to CSV',

    // Reminders Page
    'rem.title': 'Multichannel Reminders Campaign (SMS & Mail)',
    'rem.subtitle': 'Reach guardians with arrears and capture operational reminder workflows.',
    'rem.stats.unsold': 'Target parents (Dues remaining)',
    'rem.stats.sms_sent': 'SMS dispatches committed',
    'rem.stats.email_sent': 'Emails dispatches logged',
    'rem.campaign': '🚀 Set up & Launch Bulk Notifications',
    'rem.subject': 'Notification Title / Email Subject',
    'rem.body': 'Notification Template (Use variables {parent} and {amount})',
    'rem.send_sms': 'Send Bulk SMS Campaign',
    'rem.send_email': 'Send Email Campaign',
    'rem.notify.success': 'Reminder dispatches initiated!',

    // Settings Page
    'set.title': 'Association Settings & Authorized Keys',
    'set.subtitle': 'Customize your active PTA entity, establish manager access keys, and allocate budget bands.',
    'set.info_general': '🏢 General Association Information',
    'set.name': 'Association / Organization Name',
    'set.short': 'Acroynm / Label (e.g. PTA, APEE, AP)',
    'set.year': 'Active Academic School Year',
    'set.country': 'School Country Location',
    'set.currency': 'Operating Currency Code',
    'set.expected_students': 'Targeted student enrollment',
    'set.honor_expected': 'Budget Goal (Honorary members)',
    'set.aid_expected': 'Expected Alternative Grants',
    'set.save_settings': 'Commit All Settings',
    'set.budget_lines': '📊 Expenses Budget Splits (Envelope limits)',
    'set.obligations': '💳 Define Compulsory Obligations / Fees',
    'set.obligation_add': 'Add New Obligation Fee Line',
    'set.passwords': '🔒 Authorizations & Security Access Codes',
    'set.passwords_desc': 'Safeguard roles by defining split administrative passwords.',
    'set.fin_manager': 'Financial & Cash Manager contact',
    'set.ped_manager': 'Principal / Academic Supervisor contact',
    'set.notify.success': 'Configuration updated successfully!',

    // Database & Backup section in settings
    'set.db_management': '💾 Device Backups, Export & Hard Reset Desk',
    'set.db_desc': 'All PTA registers are backed up on device local storage and synced to secure database clouds.',
    'set.export': 'Export Complete Ledger (JSON)',
    'set.import': 'Restore Ledger from JSON',
    'set.reset': 'Wipe Active Ledger (DANGER)',
    'set.reset_warn': '🚨 Caution! This action will irreversibly delete all parent accounts, pupils list, cash lines, and settings on your live node!',
    
    // Messages / Inbox Module translations
    'msg.console_admin': "Communication portal for school administration and class teachers to chat with families.",
    'msg.console_parent': "Chat directly with class teachers, student monitors, and school administration.",
    'msg.active_session': "Active Session:",
    'msg.role_admin': "🏫 Administration / Faculty",
    'msg.role_parent': "👤 Parent Portal",
    'msg.search_placeholder': "Student, parent or phone...",
    'msg.all_classes': "All Classes ({count})",
    'msg.filter_active': "Active only",
    'msg.search_parent': "Search for guardian...",
    'msg.referents': "Referral Officers & Contacts",
    'msg.contact_direct': "Direct Contact:",
    'msg.no_messages': "No messages exchanged yet.",
    'msg.send_as': "Send message as:",
    'msg.contact_official': "Contact Officer:",
    'msg.back': "Back",
    'msg.teacher': "Class Teacher",
    'msg.censor': "Academic Supervisor / Censor",
    'msg.director': "Principal / School Director",
    'msg.call': "Call",
    'msg.write_to_parent': "Write to the parent of {name}...",
    'msg.write_to_teacher': "Write to class teacher of {name} ({teacher})...",
    'msg.write_to_censor': "Write to head censor / general student supervisor ({censor})...",
    'msg.write_to_director': "Write to school Principal / director ({director})...",
  },
};

const LanguageContext = createContext<TranslationContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageType>('fr');
  const [isAutoDetected, setIsAutoDetected] = useState(false);

  useEffect(() => {
    // 1. Check persistence
    const savedLang = localStorage.getItem('app_language') as LanguageType | null;
    if (savedLang === 'fr' || savedLang === 'en') {
      setLanguageState(savedLang);
      return;
    }

    // 2. Automated default language detection based on browser and geographical context
    try {
      let detectedLang: LanguageType = 'fr'; // default fallback for francophone Africa regions

      // Check navigator language strings
      const browserLang = (navigator.language || '').toLowerCase();
      const firstPref = (navigator.languages && navigator.languages[0] || '').toLowerCase();
      
      const isEnglishBrowser = browserLang.startsWith('en') || firstPref.startsWith('en');
      
      // Check timezone geo cues
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const tzLower = timeZone.toLowerCase();
      
      // Known major English-speaking timezones
      const englishTzIndicators = [
        'london', 'dublin', 'belfast', 'new_york', 'chicago', 'los_angeles', 
        'denver', 'phoenix', 'anchorage', 'honolulu', 'toronto', 'vancouver', 
        'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'auckland',
        'lagos', 'nairobi', 'johannesburg', 'accra', 'kampala', 'harare',
        'lusaka', 'kigali', 'dar_es_salaam'
      ];
      
      const isEnglishTimezone = englishTzIndicators.some(indicator => tzLower.includes(indicator));

      if (isEnglishBrowser || isEnglishTimezone) {
        detectedLang = 'en';
      }

      setLanguageState(detectedLang);
      setIsAutoDetected(true);
    } catch (e) {
      console.warn('Auto translation detection exception, falling back to fr', e);
    }
  }, []);

  const setLanguage = (lang: LanguageType) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
    setIsAutoDetected(false);
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    const dictionary = translations[language];
    let resolved = dictionary[key] || translations['fr'][key] || key;

    if (variables) {
      Object.entries(variables).forEach(([vKey, vValue]) => {
        resolved = resolved.replace(new RegExp(`\\{${vKey}\\}`, 'g'), String(vValue));
      });
    }

    return resolved;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isAutoDetected }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
