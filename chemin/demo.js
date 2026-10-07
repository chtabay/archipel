// Le chemin : un journal d’exemple, pour voir la frise avant d’avoir écrit. Trente pages, une tous les douze jours environ,
// pour traverser les saisons.
const PAGES = [
  'Premier jour de neige ! Bonhomme de neige avec les enfants, chocolat chaud et sapin de Noël.',
  'Je suis resté au lit, fatigué. J’ai lu un livre, le chat dormait sur le canapé.',
  'Longue réunion au bureau, mon patron était pressé. Le soir, la ville sous la pluie.',
  'Balade en forêt avec ma sœur. Des champignons partout, l’odeur des feuilles mouillées.',
  'Courses au marché : du pain, du fromage, des pommes. Le boulanger m’a souri.',
  'Journée triste. Je pense à ma grand-mère. J’ai pleuré dans la voiture.',
  'Les premières fleurs dans le jardin. J’ai planté des carottes et des tomates.',
  'Dîner chez des amis, on a beaucoup ri. Gâteau d’anniversaire pour Paul, et du vin.',
  'Train pour Lyon, valise, gare bondée. Enfin des vacances.',
  'J’ai fait du vélo dans la campagne, des vaches dans les prés, un tracteur sur la route.',
  'Matin calme. Café sur le balcon, les oiseaux, personne dans la rue.',
  'Pique-nique au bord de la mer, les enfants ont construit un château de sable. Un bateau passait au loin.',
  'Baignade, sable chaud, un voilier à l’horizon. Je voudrais que ça dure.',
  'Camping au bord du lac. Feu de camp, tente, les étoiles. Nuit froide mais belle.',
  'Retour au travail. Ordinateur, mails, encore des mails. Je suis épuisé.',
  'J’ai cuisiné une soupe de légumes pour toute la famille. Mon fils a fait la vaisselle.',
  'Promenade du chien dans le parc. Il a couru après un lapin.',
  'Colère contre moi-même, une dispute idiote. La nuit, je n’arrivais pas à dormir.',
  'Atelier de peinture, j’ai dessiné un arbre. Ma fille joue de la guitare.',
  'Pluie d’automne, feuilles rousses. Thé et une couverture.',
  'Marché de Noël, lumières, cadeaux pour tout le monde.',
  'Médecin ce matin, mal au dos. Je me suis reposé tout l’après-midi.',
  'Neige sur le village, un traîneau, les enfants rient.',
  'Déménagement : des cartons partout, une nouvelle cuisine.',
  'Soirée tranquille avec mon amoureuse, bougies, une pizza.',
  'Le port au soleil, des bateaux de pêche, des poissons au marché.',
  'Randonnée en montagne, pins, rochers, un renard sur le sentier.',
  'Je n’ai rien fait. Le calme, le silence, la sieste.',
  'Anniversaire de ma mère, toute la famille autour de la table, un grand gâteau.',
  'Aujourd’hui j’ai commencé ce journal. Un chemin, une page après l’autre.',
];
export function demo(fin = new Date()) { // les dates, en remontant depuis aujourd’hui
  const jour = 864e5, n = PAGES.length;
  return PAGES.map((texte, i) => ({ date: new Date(fin.getTime() - (n - 1 - i) * 12 * jour).toISOString().slice(0, 10), texte }));
}
