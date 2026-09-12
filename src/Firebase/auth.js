import { auth } from "./config";
import { createUserWithEmailAndPassword , 
        GoogleAuthProvider ,
        sendEmailVerification,
        sendPasswordResetEmail,
        signInWithEmailAndPassword, 
        signInWithPopup,
        updatePassword,
        OAuthProvider, getAdditionalUserInfo} from "firebase/auth";

const recordAcquisition = result => {
    import('../Services/SeoMiniProductService').then(service => service.recordSeoSignup(result.user, Boolean(getAdditionalUserInfo(result)?.isNewUser))).catch(() => {});
    return result;
};

export const handleCreateUserWithEmailAndPassword = async (auth,email, password) => {
    return createUserWithEmailAndPassword(auth,email,password).then(recordAcquisition);
};


export const handleSignInWithEMailAndPassword = (email,password) => {
    return signInWithEmailAndPassword(auth,email,password).then(recordAcquisition);
};

export const handleSignInWithGoogleAccount = async() => {
    try {
        const Provider = new GoogleAuthProvider();
        const signInResult = await signInWithPopup(auth, Provider);
        return recordAcquisition(signInResult);
    } catch (error) {
        console.error('Google sign-in error:', error);

        // Handle specific error cases
        switch (error.code) {
            case 'auth/popup-blocked':
                throw new Error('Sign-in popup was blocked by the browser. Please allow popups for this site.');
            case 'auth/popup-closed-by-user':
                throw new Error('Sign-in popup was closed before completing.');
            case 'auth/cancelled-popup-request':
                throw new Error('Sign-in was cancelled.');
            case 'auth/account-exists-with-different-credential':
                throw new Error('An account already exists with the same email address but different sign-in credentials.');
            case 'auth/unauthorized-domain':
                throw new Error('This domain is not authorized for Google sign-in. Please contact support.');
            default:
                throw error;
        }
    }
};

export const handleSignOut = () => {
    console.log("Attempt to Sign Out");
    return auth.signOut();
};

export const handlePasswordReset = (email) => {
    return sendPasswordResetEmail(auth, email);
};


export const handlePasswordChange = (password) => {
    return updatePassword(auth.currentUser, password);
}

export const handleEmailVerification = () => {
    return sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/home`
    });
};


// Apple Sign-In function
export const handleSignInWithAppleAccount = async () => {
  try {
    const provider = new OAuthProvider('apple.com');
    
    // Optional: Add scopes (what information you want from Apple)
    provider.addScope('email');
    provider.addScope('name');
    
    // Optional: Set custom parameters
    provider.setCustomParameters({
      // Forces account selection even if one account is available
      'login_hint': ''
    });

    const result = await signInWithPopup(auth, provider);
    recordAcquisition(result);
    
    // The signed-in user info
    const user = result.user;
    
    // Apple ID credential
    const credential = OAuthProvider.credentialFromResult(result);
    const accessToken = credential.accessToken;
    const idToken = credential.idToken;
    
    console.log('Apple sign-in successful:', user);
    return user;
    
  } catch (error) {
    console.error('Apple sign-in error:', error);
    
    // Handle specific error cases
    switch (error.code) {
      case 'auth/account-exists-with-different-credential':
        throw new Error('An account already exists with the same email address but different sign-in credentials.');
      case 'auth/cancelled-popup-request':
        throw new Error('Sign-in was cancelled.');
      case 'auth/popup-blocked':
        throw new Error('Sign-in popup was blocked by the browser.');
      case 'auth/popup-closed-by-user':
        throw new Error('Sign-in popup was closed before completing.');
      default:
        throw new Error(`Apple sign-in failed: ${error.message}`);
    }
  }
};
