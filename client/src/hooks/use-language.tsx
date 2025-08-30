import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation dictionary
const translations: Record<string, Record<string, string>> = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.tradeNow': 'Trade Now',
    'nav.invite': 'Invite',
    'nav.profile': 'Profile',
    
    // Profile Page
    'profile.welcome': 'Welcome back to Nebrix',
    'profile.totalAssets': 'Total Assets (USDT)',
    'profile.quantitativeAccount': 'Quantitative Account (USDT)',
    'profile.profitAssets': 'Profit Assets (USDT)',
    'profile.depositAmount': 'Deposit Amount (USDT)',
    'profile.withdrawable': 'Withdrawable (USDT)',
    'profile.deposit': 'Deposit',
    'profile.withdraw': 'Withdraw',
    'profile.detail': 'Detail',
    'profile.securityCenter': 'Security Center',
    'profile.quantizationTutorial': 'Tutorial',
    'profile.news': 'News',
    'profile.languageSettings': 'Language Settings',
    'profile.commonProblem': 'Common Problem',
    'profile.aboutUs': 'About Us',
    'profile.downloadApp': 'Download APP',
    'profile.signOut': 'Sign Out',
    
    // Dashboard
    'dashboard.totalAssets': 'Total Assets',
    'dashboard.profitAssets': 'Profit Assets',
    'dashboard.todayEarnings': 'Today Earnings',
    'dashboard.yesterdayEarnings': 'Yesterday Earnings',
    'dashboard.deposit': 'Deposit',
    'dashboard.withdraw': 'Withdraw',
    'dashboard.aiTrading': 'AI Trading',
    'dashboard.marketBanner': 'Market trading is in USDT, and the minimum withdrawal amount is 5 USDT. The withdrawal fee is 5%. Minimum Deposit is $5, Daily Returns is 1.5% and Withdrawal is available every day. Please note Trading Signals is once Per Day',
    
    // Invite Page
    'invite.title': 'Invite Friends',
    'invite.myReferralCode': 'My Referral Code',
    'invite.copyCode': 'Generate New Code',
    'invite.inviteLink': 'Invite Link',
    'invite.copyLink': 'Copy Link',
    'invite.totalEarnings': 'Total Earnings',
    'invite.directReferrals': 'Direct Referrals',
    'invite.teamMembers': 'Team Members',
    'invite.howItWorks': 'How It Works',
    'invite.step1': 'Share your referral code',
    'invite.step2': 'Friends sign up using your code',
    'invite.step3': 'Earn commissions from their trades',
    
    // Quantitative Page
    'quantitative.title': 'AI Trading',
    'quantitative.availableBalance': 'Available Balance',
    'quantitative.investmentAmount': 'Investment Amount',
    'quantitative.dailyReturn': 'Daily Return',
    'quantitative.minimumInvestment': 'Minimum Investment',
    'quantitative.maximumInvestment': 'Maximum Investment',
    'quantitative.investNow': 'Invest Now',
    'quantitative.activeInvestments': 'Active Investments',
    'quantitative.investmentHistory': 'Investment History',
    
    // Common
    'common.comingSoon': 'Coming Soon!',
    'common.featureUnderDevelopment': 'This feature is currently under development and will be available soon.',
    'common.gotIt': 'Got it',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.close': 'Close',
    
    // Rank System
    'rank.noRank': 'No Rank',
    'rank.totalVolume': 'Total Volume',
    'rank.nextRank': 'Next Rank',
    'rank.remaining': 'remaining',
    'rank.currentRank': 'Current Rank',
    'rank.incentiveEarned': 'Incentive Earned',
  },
  es: {
    // Navigation
    'nav.home': 'Inicio',
    'nav.tradeNow': 'Operar Ahora',
    'nav.invite': 'Invitar',
    'nav.profile': 'Perfil',
    
    // Profile Page
    'profile.welcome': 'Bienvenido de vuelta a Nebrix',
    'profile.totalAssets': 'Activos Totales (USDT)',
    'profile.quantitativeAccount': 'Cuenta Cuantitativa (USDT)',
    'profile.profitAssets': 'Activos de Ganancia (USDT)',
    'profile.depositAmount': 'Cantidad de Depósito (USDT)',
    'profile.withdrawable': 'Retirable (USDT)',
    'profile.deposit': 'Depósito',
    'profile.withdraw': 'Retirar',
    'profile.detail': 'Detalle',
    'profile.securityCenter': 'Centro de Seguridad',
    'profile.quantizationTutorial': 'Tutorial de Cuantización',
    'profile.news': 'Noticias',
    'profile.languageSettings': 'Configuración de Idioma',
    'profile.commonProblem': 'Problema Común',
    'profile.aboutUs': 'Acerca de Nosotros',
    'profile.downloadApp': 'Descargar APP',
    'profile.signOut': 'Cerrar Sesión',
    
    // Dashboard
    'dashboard.totalAssets': 'Activos Totales',
    'dashboard.profitAssets': 'Activos de Ganancia',
    'dashboard.todayEarnings': 'Ganancias de Hoy',
    'dashboard.yesterdayEarnings': 'Ganancias de Ayer',
    'dashboard.deposit': 'Depósito',
    'dashboard.withdraw': 'Retirar',
    'dashboard.aiTrading': 'Trading IA',
    'dashboard.marketBanner': 'El trading del mercado es en USDT, y el monto mínimo de retiro es 1 USDT. La tarifa de retiro es 10%. El depósito mínimo es $5, los retornos diarios son 1.5% y el retiro está disponible todos los días. Tenga en cuenta que las señales de trading son una vez por día',
    
    // Invite Page
    'invite.title': 'Invitar Amigos',
    'invite.myReferralCode': 'Mi Código de Referido',
    'invite.copyCode': 'Copiar Código',
    'invite.inviteLink': 'Enlace de Invitación',
    'invite.copyLink': 'Copiar Enlace',
    'invite.totalEarnings': 'Ganancias Totales',
    'invite.directReferrals': 'Referencias Directas',
    'invite.teamMembers': 'Miembros del Equipo',
    'invite.howItWorks': 'Cómo Funciona',
    'invite.step1': 'Comparte tu código de referido',
    'invite.step2': 'Los amigos se registran usando tu código',
    'invite.step3': 'Gana comisiones de sus operaciones',
    
    // Quantitative Page
    'quantitative.title': 'Trading IA',
    'quantitative.availableBalance': 'Saldo Disponible',
    'quantitative.investmentAmount': 'Monto de Inversión',
    'quantitative.dailyReturn': 'Retorno Diario',
    'quantitative.minimumInvestment': 'Inversión Mínima',
    'quantitative.maximumInvestment': 'Inversión Máxima',
    'quantitative.investNow': 'Invertir Ahora',
    'quantitative.activeInvestments': 'Inversiones Activas',
    'quantitative.investmentHistory': 'Historial de Inversiones',
    
    // Common
    'common.comingSoon': '¡Próximamente!',
    'common.featureUnderDevelopment': 'Esta función está actualmente en desarrollo y estará disponible pronto.',
    'common.gotIt': 'Entendido',
  },
  fr: {
    // Navigation
    'nav.home': 'Accueil',
    'nav.tradeNow': 'Trader Maintenant',
    'nav.invite': 'Inviter',
    'nav.profile': 'Profil',
    
    // Profile Page
    'profile.welcome': 'Bienvenue sur Nebrix',
    'profile.totalAssets': 'Actifs Totaux (USDT)',
    'profile.quantitativeAccount': 'Compte Quantitatif (USDT)',
    'profile.profitAssets': 'Actifs de Profit (USDT)',
    'profile.depositAmount': 'Montant du Dépôt (USDT)',
    'profile.withdrawable': 'Retirable (USDT)',
    'profile.deposit': 'Dépôt',
    'profile.withdraw': 'Retirer',
    'profile.detail': 'Détail',
    'profile.securityCenter': 'Centre de Sécurité',
    'profile.quantizationTutorial': 'Tutoriel de Quantification',
    'profile.news': 'Actualités',
    'profile.languageSettings': 'Paramètres de Langue',
    'profile.commonProblem': 'Problème Courant',
    'profile.aboutUs': 'À Propos',
    'profile.downloadApp': 'Télécharger APP',
    'profile.signOut': 'Se Déconnecter',
    
    // Dashboard
    'dashboard.totalAssets': 'Actifs Totaux',
    'dashboard.profitAssets': 'Actifs de Profit',
    'dashboard.todayEarnings': 'Gains Aujourd\'hui',
    'dashboard.yesterdayEarnings': 'Gains Hier',
    'dashboard.deposit': 'Dépôt',
    'dashboard.withdraw': 'Retirer',
    'dashboard.aiTrading': 'Trading IA',
    'dashboard.marketBanner': 'Le trading de marché est en USDT, et le montant minimum de retrait est 5 USDT. Les frais de retrait sont de 10%. Le dépôt minimum est de $5, les rendements quotidiens sont de 1,5% et le retrait est disponible tous les jours. Veuillez noter que les signaux de trading sont une fois par jour',
    
    // Invite Page
    'invite.title': 'Inviter des Amis',
    'invite.myReferralCode': 'Mon Code de Parrainage',
    'invite.copyCode': 'Copier le Code',
    'invite.inviteLink': 'Lien d\'Invitation',
    'invite.copyLink': 'Copier le Lien',
    'invite.totalEarnings': 'Gains Totaux',
    'invite.directReferrals': 'Parrainages Directs',
    'invite.teamMembers': 'Membres de l\'Équipe',
    'invite.howItWorks': 'Comment ça Marche',
    'invite.step1': 'Partagez votre code de parrainage',
    'invite.step2': 'Les amis s\'inscrivent avec votre code',
    'invite.step3': 'Gagnez des commissions sur leurs trades',
    
    // Quantitative Page
    'quantitative.title': 'Trading IA',
    'quantitative.availableBalance': 'Solde Disponible',
    'quantitative.investmentAmount': 'Montant d\'Investissement',
    'quantitative.dailyReturn': 'Rendement Quotidien',
    'quantitative.minimumInvestment': 'Investissement Minimum',
    'quantitative.maximumInvestment': 'Investissement Maximum',
    'quantitative.investNow': 'Investir Maintenant',
    'quantitative.activeInvestments': 'Investissements Actifs',
    'quantitative.investmentHistory': 'Historique des Investissements',
    
    // Common
    'common.comingSoon': 'Bientôt Disponible!',
    'common.featureUnderDevelopment': 'Cette fonctionnalité est actuellement en développement et sera bientôt disponible.',
    'common.gotIt': 'Compris',
  },
  zh: {
    // Navigation
    'nav.home': '首页',
    'nav.tradeNow': '立即交易',
    'nav.invite': '邀请',
    'nav.profile': '个人资料',
    
    // Profile Page
    'profile.welcome': '欢迎回到 Nebrix',
    'profile.totalAssets': '总资产 (USDT)',
    'profile.quantitativeAccount': '量化账户 (USDT)',
    'profile.profitAssets': '盈利资产 (USDT)',
    'profile.depositAmount': '存款金额 (USDT)',
    'profile.withdrawable': '可提取 (USDT)',
    'profile.deposit': '存款',
    'profile.withdraw': '提取',
    'profile.detail': '详情',
    'profile.securityCenter': '安全中心',
    'profile.quantizationTutorial': '量化教程',
    'profile.news': '新闻',
    'profile.languageSettings': '语言设置',
    'profile.commonProblem': '常见问题',
    'profile.aboutUs': '关于我们',
    'profile.downloadApp': '下载应用',
    'profile.signOut': '退出登录',
    
    // Dashboard
    'dashboard.totalAssets': '总资产',
    'dashboard.profitAssets': '盈利资产',
    'dashboard.todayEarnings': '今日收益',
    'dashboard.yesterdayEarnings': '昨日收益',
    'dashboard.deposit': '存款',
    'dashboard.withdraw': '提取',
    'dashboard.aiTrading': 'AI交易',
    'dashboard.marketBanner': '市场交易以USDT计价，最低提现金额为1 USDT。提现手续费为10%。最低存款为$5，每日回报为1.5%，每天都可以提现。请注意交易信号每天一次',
    
    // Invite Page
    'invite.title': '邀请朋友',
    'invite.myReferralCode': '我的推荐码',
    'invite.copyCode': '复制代码',
    'invite.inviteLink': '邀请链接',
    'invite.copyLink': '复制链接',
    'invite.totalEarnings': '总收益',
    'invite.directReferrals': '直接推荐',
    'invite.teamMembers': '团队成员',
    'invite.howItWorks': '工作原理',
    'invite.step1': '分享您的推荐码',
    'invite.step2': '朋友使用您的代码注册',
    'invite.step3': '从他们的交易中赚取佣金',
    
    // Quantitative Page
    'quantitative.title': 'AI交易',
    'quantitative.availableBalance': '可用余额',
    'quantitative.investmentAmount': '投资金额',
    'quantitative.dailyReturn': '每日回报',
    'quantitative.minimumInvestment': '最低投资',
    'quantitative.maximumInvestment': '最高投资',
    'quantitative.investNow': '立即投资',
    'quantitative.activeInvestments': '活跃投资',
    'quantitative.investmentHistory': '投资历史',
    
    // Common
    'common.comingSoon': '即将推出！',
    'common.featureUnderDevelopment': '此功能目前正在开发中，即将推出。',
    'common.gotIt': '知道了',
  },
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('selectedLanguage') || 'en';
  });

  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLanguage(event.detail.language);
    };

    window.addEventListener('languageChanged', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('languageChanged', handleLanguageChange as EventListener);
    };
  }, []);

  const setLanguage = (language: string) => {
    setCurrentLanguage(language);
    localStorage.setItem('selectedLanguage', language);
  };

  const t = (key: string): string => {
    return translations[currentLanguage]?.[key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
