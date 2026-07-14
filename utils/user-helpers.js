import {
  getFullImageUrl,
  getDefaultAvatarPath,
} from '../helpers/cloudinary-service.js';

export const buildUserResponse = (user) => {
  // Obtener la URL de la imagen de perfil
  const profilePictureUrl =
    user.UserProfile && user.UserProfile.Imagen
      ? getFullImageUrl(user.UserProfile.Imagen)
      : getFullImageUrl(getDefaultAvatarPath());

  return {
    id: user.Id,
    name: user.Name,
    email: user.Email,
    UserProfile: user.UserProfile ? {
      Phone: user.UserProfile.Phone,
      Address: user.UserProfile.Address,
      Imagen: user.UserProfile.Imagen,
    } : null,
    phone:
      user.UserProfile && user.UserProfile.Phone ? user.UserProfile.Phone : '',
    profilePicture: profilePictureUrl,
    role: user.UserRoles?.[0]?.Role?.Name ?? 'USER_ROLE',
    isActive: user.IsActive,
    isEmailVerified: user.UserEmail ? user.UserEmail.EmailVerified : false,
    createdAt: user.CreatedAt,
    updatedAt: user.UpdatedAt,
  };
};
