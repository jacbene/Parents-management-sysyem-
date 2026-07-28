import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Server, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  RefreshCw, 
  Send, 
  Download, 
  HelpCircle, 
  ExternalLink, 
  Mail, 
  Globe, 
  Key, 
  Database, 
  Terminal, 
  Info, 
  Layers, 
  FileText,
  Search,
  CheckSquare
} from 'lucide-react';

export interface DnsRecord {
  id: string;
  type: 'TXT' | 'CNAME' | 'MX';
  name: string;
  value: string;
  category: 'Domain Verification' | 'Sending' | 'Tracking';
  required: boolean;
  status: 'pending' | 'verified' | 'failed';
  ttl?: string;
  description: string;
}

const INITIAL_DNS_RECORDS: DnsRecord[] = [
  {
    id: 'dkim-1',
    type: 'TXT',
    name: 'bird-432-0726._domainkey',
    value: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm++gQ9mvQp578a709rQ+oJoWJNzg+x0FQFnxlLptXwfnosShKhFwvgXhUD3YH6yW2Fa29KLl3jp2jXA7BgrMQP7Lt9barctc2MvSmPlviwE6EQcNaRrOqo84mObuJM9XM7vJucqvU5uT442gXfHgC/teTkAJ3b/VZOLzJ8rv2+FjiZY9OkLARJJFZI451Q3p/QSHi0YW/6m7MTOHdoATCA9VMd6W3UWFCZNsjg772zaX1/gmWQ6pkbnK5qIGMh0lUr8buplmsfAwRzI2SNSCeG8sFGQId6qL6vodyCpq3ybSSsUHatSKDO3Ex5ukIwOS2xLyKB95k9DCQ5inpJv/lQIDAQAB',
    category: 'Domain Verification',
    required: true,
    status: 'pending',
    ttl: '3600 (Automatique)',
    description: 'Clé DKIM pour authentifier les e-mails émis au nom du domaine et éviter le passage en Spam.'
  },
  {
    id: 'send-cname',
    type: 'CNAME',
    name: 'send',
    value: 'eu1.bounce.bird.com',
    category: 'Sending',
    required: true,
    status: 'pending',
    ttl: '3600',
    description: 'Redirection de rebond (Bounce CNAME) requise pour acheminer les e-mails via Bird Mail Services.'
  },
  {
    id: 'dmarc-txt',
    type: 'TXT',
    name: '_dmarc',
    value: 'v=DMARC1; p=none; rua=mailto:dmarc-agg@dmarc.bird.com;',
    category: 'Sending',
    required: true,
    status: 'pending',
    ttl: '3600',
    description: 'Politique DMARC définissant la conformité et le rapport d’alignement des expéditeurs.'
  },
  {
    id: 'tracking-cname',
    type: 'CNAME',
    name: 'links',
    value: 'eu1.links.bird.com',
    category: 'Tracking',
    required: false,
    status: 'pending',
    ttl: '3600',
    description: 'Optionnel. Permet le suivi des ouvertures et des clics sur un domaine personnalisé.'
  }
];

export default function EmailInfrastructure() {
  const [records, setRecords] = useState<DnsRecord[]>(INITIAL_DNS_RECORDS);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'required' | 'pending' | 'verified'>('all');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Test Email state
  const [testEmailRecipient, setTestEmailRecipient] = useState('jacquesbene301@gmail.com');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  const targetDomain = "ai-studio-parentsmanagemen-a76095ec-7323-4938-ad10-394b9712f70f.firebaseapp.com";
  const serviceProvider = "Bird Email Platform (eu1.bird.com)";

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2200);
  };

  const toggleRecordStatus = (id: string) => {
    setRecords(prev => prev.map(rec => {
      if (rec.id === id) {
        const nextStatus = rec.status === 'pending' ? 'verified' : rec.status === 'verified' ? 'failed' : 'pending';
        return { ...rec, status: nextStatus };
      }
      return rec;
    }));
  };

  const handleRunDnsCheck = async () => {
    setIsVerifying(true);
    setLastChecked(null);

    // Simulate DNS lookup check
    await new Promise(res => setTimeout(res, 1200));

    setLastChecked(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setIsVerifying(false);
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) return;

    setIsSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const response = await fetch('/api/send-confirmation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmailRecipient.trim(),
          name: "Administrateur PASMA-SYS",
          type: "verification"
        })
      });

      const data = await response.json();
      if (data.success) {
        setTestEmailResult({
          success: true,
          message: data.message || "E-mail de test expédié avec succès !",
          details: data.testUrl ? `Aperçu disponible : ${data.testUrl}` : `ID Message: ${data.messageId || 'N/A'}`
        });
      } else {
        setTestEmailResult({
          success: false,
          message: data.error || "Échec de l'envoi de l'e-mail de test."
        });
      }
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: "Erreur lors de la communication avec le serveur d'envoi.",
        details: err.message
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleExportTxt = () => {
    const textContent = `==== REGISTRE DES ENREGISTREMENTS DNS (BIRD / PASMA-SYS) ====
Domaine: ${targetDomain}
Prestataire: ${serviceProvider}
Date d'exportation: ${new Date().toLocaleString('fr-FR')}

${records.map((r, index) => `
[Enregistrement #${index + 1}]
Type: ${r.type}
Nom / Hôte: ${r.name}
Valeur / Cible: ${r.value}
Catégorie: ${r.category} (${r.required ? 'REQUIS' : 'OPTIONNEL'})
Statut actuel: ${r.status.toUpperCase()}
Description: ${r.description}
--------------------------------------------------`).join('\n')}
`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dns-records-${targetDomain.slice(0, 20)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter(rec => {
    if (filterCategory === 'required' && !rec.required) return false;
    if (filterCategory === 'pending' && rec.status !== 'pending') return false;
    if (filterCategory === 'verified' && rec.status !== 'verified') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return rec.name.toLowerCase().includes(q) || 
             rec.value.toLowerCase().includes(q) || 
             rec.type.toLowerCase().includes(q) ||
             rec.category.toLowerCase().includes(q);
    }
    return true;
  });

  const pendingCount = records.filter(r => r.status === 'pending').length;
  const verifiedCount = records.filter(r => r.status === 'verified').length;
  const requiredCount = records.filter(r => r.required).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl text-indigo-400 backdrop-blur-sm">
                <Server className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Infrastructure E-mail & Supervision DNS
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Gestion des clés d'authentification DKIM, CNAME, DMARC et serveurs SMTP Bird Mail
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunDnsCheck}
                disabled={isVerifying}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>Vérifier la propagation</span>
              </button>

              <button
                onClick={handleExportTxt}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Exporter .TXT</span>
              </button>
            </div>
          </div>

          {/* Key Metadata Badges */}
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex items-center gap-3">
              <Globe className="w-5 h-5 text-indigo-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Domaine Raccordé</p>
                <p className="text-xs font-mono font-bold text-slate-200 truncate" title={targetDomain}>
                  {targetDomain}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex items-center gap-3">
              <Layers className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plateforme & SMTP</p>
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {serviceProvider}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statut des Registres</p>
                <p className="text-xs font-bold text-amber-300">
                  {pendingCount > 0 ? `${pendingCount} en attente de validation` : 'Tous les enregistrements validés'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DNS Verification Alert Box */}
      <div className="p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-2xl flex flex-col sm:flex-row items-start gap-4">
        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 rounded-xl shrink-0 mt-0.5">
          <Clock className="w-6 h-6" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Procédure de vérification DNS en cours chez le prestataire Bird
            </h3>
            {lastChecked && (
              <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400 bg-amber-200/50 dark:bg-amber-900/80 px-2 py-0.5 rounded-md">
                Dernier contrôle : {lastChecked}
              </span>
            )}
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            Pour activer l'envoi d'e-mails sécurisés depuis votre domaine, ajoutez les enregistrements ci-dessous dans la zone DNS de votre hébergeur (Cloudflare, OVH, GoDaddy, Namecheap ou Firebase Custom Domain).
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
            💡 <strong>Délai de propagation :</strong> Les mises à jour DNS prennent généralement entre <strong>5 minutes et 24 heures</strong> pour se propager à l'échelle mondiale.
          </p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              filterCategory === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tous ({records.length})
          </button>
          <button
            onClick={() => setFilterCategory('required')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              filterCategory === 'required'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Obligatoires ({requiredCount})
          </button>
          <button
            onClick={() => setFilterCategory('pending')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              filterCategory === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            En attente ({pendingCount})
          </button>
          <button
            onClick={() => setFilterCategory('verified')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
              filterCategory === 'verified'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Vérifiés ({verifiedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une clé DNS..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      {/* DNS Records List */}
      <div className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <Info className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Aucun enregistrement trouvé</p>
            <p className="text-xs text-slate-500">Essayez de modifier votre filtre ou terme de recherche.</p>
          </div>
        ) : (
          filteredRecords.map((record) => {
            const isCopyingName = copiedField === `${record.id}-name`;
            const isCopyingValue = copiedField === `${record.id}-value`;

            return (
              <div
                key={record.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono font-extrabold text-xs rounded-lg uppercase tracking-wider">
                      {record.type}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {record.category}
                    </span>
                    {record.required ? (
                      <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded-md border border-rose-200 dark:border-rose-800/60">
                        REQUIS
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold rounded-md">
                        OPTIONNEL
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRecordStatus(record.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        record.status === 'verified'
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                          : record.status === 'failed'
                          ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      }`}
                      title="Cliquer pour simuler/changer le statut de vérification"
                    >
                      {record.status === 'verified' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>VÉRIFIÉ</span>
                        </>
                      ) : record.status === 'failed' ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>ÉCHEC</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>EN ATTENTE</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {record.description}
                </p>

                {/* Name & Value Code Blocks */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Name / Host */}
                  <div className="lg:col-span-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <span>TYPE & NOM (HÔTE)</span>
                      <span>TTL: {record.ttl || '3600'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-slate-100 font-bold break-all gap-2">
                      <span className="select-all">{record.name}</span>
                      <button
                        onClick={() => handleCopy(record.name, `${record.id}-name`)}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition shrink-0 cursor-pointer"
                        title="Copier le nom"
                      >
                        {isCopyingName ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Value / Target */}
                  <div className="lg:col-span-8 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <span>VALEUR (CIBLE / POINTEUR)</span>
                      {isCopyingValue && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copié dans le presse-papier !</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-slate-100 break-all gap-2">
                      <span className="select-all leading-relaxed font-semibold">{record.value}</span>
                      <button
                        onClick={() => handleCopy(record.value, `${record.id}-value`)}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition shrink-0 cursor-pointer"
                        title="Copier la valeur"
                      >
                        {isCopyingValue ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Test Email Dispatcher Panel */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Tester l'envoi d'e-mail de confirmation en temps réel
            </h3>
            <p className="text-xs text-slate-500">
              Expédie un message de vérification complet via le backend SMTP/Nodemailer pour valider la délivrabilité.
            </p>
          </div>
        </div>

        <form onSubmit={handleSendTestEmail} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <input
              type="email"
              value={testEmailRecipient}
              onChange={(e) => setTestEmailRecipient(e.target.value)}
              placeholder="Saisissez votre e-mail de test (ex: admin@domaine.com)"
              required
              className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <button
              type="submit"
              disabled={isSendingTestEmail}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 shrink-0"
            >
              {isSendingTestEmail ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Envoyer un e-mail de test</span>
                </>
              )}
            </button>
          </div>

          {testEmailResult && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-2xl border text-xs font-medium space-y-1 ${
                testEmailResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="font-bold flex items-center gap-2">
                {testEmailResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{testEmailResult.message}</span>
              </div>
              {testEmailResult.details && (
                <p className="text-[11px] font-mono opacity-90 break-all pl-6">
                  {testEmailResult.details}
                </p>
              )}
            </motion.div>
          )}
        </form>
      </div>

      {/* Registrar Configuration Instructions */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-500" />
          <span>Guide pas à pas pour ajouter ces enregistrements chez votre Registar</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] flex items-center justify-center font-black">1</span>
              <span>1. Connectez-vous à la zone DNS</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              Allez dans le panneau de gestion de votre nom de domaine (ex: OVH, Cloudflare, GoDaddy, Google Domains) et ouvrez l'onglet <strong>Zone DNS</strong> ou <strong>DNS Management</strong>.
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] flex items-center justify-center font-black">2</span>
              <span>2. Ajoutez chaque ligne exacte</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              Créez un nouvel enregistrement pour chaque type (<strong>TXT</strong> ou <strong>CNAME</strong>), collez le <strong>Nom/Hôte</strong> et la <strong>Valeur</strong> fournis ci-dessus sans altération.
            </p>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] flex items-center justify-center font-black">3</span>
              <span>3. Validation automatique</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              Une fois enregistrés, le système Bird et le relais SMTP vérifieront automatiquement la présence des clés DKIM et CNAME en arrière-plan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
