// Config plugin local : retire l'entitlement `aps-environment` (Push Notifications)
// qu'expo-notifications ajoute automatiquement. Les comptes Apple gratuits (Personal Team)
// ne supportent pas cette capability → on la supprime pour pouvoir signer.
// Les notifications LOCALES (rappels de prono) continuent de marcher sans cet entitlement.
// Le jour d'un compte payant + push distant : supprimer ce plugin et rajouter "expo-notifications".
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
