# Conception du module Admins

## 1. Objectif

Le module Admins gere les comptes d'administration delegues.

Il permet a un responsable de :

- lister les sous-admins ;
- creer un sous-admin ;
- mettre a jour un sous-admin ;
- supprimer un sous-admin.

Le point d'entree principal est :

- `Backend/routes/admins.routes.js`

## 2. Positionnement

Le module ne gere pas l'authentification complete.

Il s'appuie sur :

- le systeme d'auth existant ;
- les roles utilisateurs ;
- le modele `utilisateur.js`.

Sa responsabilite est la gouvernance des comptes `ADMIN` delegues.

## 3. Contrainte d'acces

Toutes les routes exigent :

- `userAuth`
- `userResponsable`

La conception impose donc un controle par role au niveau du routeur,
pas uniquement au niveau du frontend.

## 4. Compatibilite de schema

Le modele `Backend/src/model/utilisateur.js` gere deux variantes de schema :

- un schema moderne avec `utilisateur_roles` et `roles` ;
- un schema legacy avec un champ `utilisateurs.role`.

Le module Admins herite directement de cette double compatibilite.

Cela explique la presence de requetes `fallback` dans le modele.

## 5. Regles metier

- nom obligatoire ;
- prenom obligatoire ;
- email obligatoire ;
- mot de passe minimum a `6` caracteres lors de la creation ;
- mot de passe optionnel a la mise a jour ;
- email unique ;
- le module cible uniquement les comptes portant le role `ADMIN`.

## 6. Frontiere fonctionnelle

Le module Admins ne gere pas :

- la connexion ;
- la session ;
- les roles multiples avances ;
- la suppression de comptes responsables.

Il se concentre sur le sous-ensemble delegue d'administration.

## 7. Points de vigilance

- la qualite du module depend de la coherence entre le role de session et le role persiste ;
- les conflits d'unicite d'email doivent rester explicites pour l'interface ;
- le support schema moderne / schema legacy doit etre preserve tant que la migration n'est pas finalisee.

## 8. Conclusion

Le module Admins est une couche de gouvernance ciblee, adossee au systeme
d'authentification et concue pour fonctionner dans un contexte de schema evolutif.
