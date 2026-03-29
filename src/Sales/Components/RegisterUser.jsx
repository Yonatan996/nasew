import React, { useState,useEffect } from "react";
import { getAuth, signInWithPopup, FacebookAuthProvider, GoogleAuthProvider } from "firebase/auth";
import { initializeApp } from "firebase/app";
import logo from './Dynamic logo-03.png'; // You can use this for your logo
// import { db, collection, getDocs, query, where } from './firebase'; 
// Firebase configuration


const RegisterUser = () => {
    const [position, setPosition] = useState('');
    const [supervisors, setSupervisors] = useState([]);
    const [selectedSupervisor, setSelectedSupervisor] = useState('');

   
  
    // Fetch supervisors from Firestore
    useEffect(() => {
      if (position === 'Sales') {
        const fetchSupervisors = async () => {
          try {
            // Query Firestore for users with position 'Supervisor'
            const q = query(collection(db, 'user'), where('Position', '==', 'Supervisor'));
            const querySnapshot = await getDocs(q);
  console.log(q)
            // Map Firestore results to an array of supervisors
            const supervisorList = querySnapshot.docs.map((doc) => ({
              id: doc.id,
              name: doc.data().name,
            }));
  
            setSupervisors(supervisorList);
          } catch (error) {
            console.error('Error fetching supervisors:', error);
          }
        };
  
        fetchSupervisors();
      } else {
        setSupervisors([]); // Clear supervisor list if position is not Sales
      }
    }, [position]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-1 text-center text-3xl font-extrabold text-gray-900">Register Users</h2>
       
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" action="#" method="POST">
          <div>
        <div className="mt-1">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Enter your email address"
          />
        </div>
      </div>

      {/* First Name */}
      <div>
        <div className="mt-1">
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Enter your first name"
          />
        </div>
      </div>

      {/* Last Name */}
      <div>
        <div className="mt-1">
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Enter your last name"
          />
        </div>
      </div>

      {/* Gender */}
      <div>
        <div className="mt-1">
          <select
            id="gender"
            name="gender"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      {/* Phone */}
      <div>
        <div className="mt-1">
          <input
            id="phone"
            name="phone"
            type="text"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Enter your phone number"
          />
        </div>
      </div>

      {/* Position */}
      <div>
        <div className="mt-1">
          <select
            id="position"
            name="position"
            required
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
          >
            <option value="">Select Position</option>
            <option value="Manager">Manager</option>
            <option value="Sales">Sales</option>
            <option value="Supervisor">Supervisor</option>
          </select>
        </div>
      </div>

      {/* Supervisor - Only shows when Position is "Sales" */}
      {position === 'Sales' && (
        <div>
          <div className="mt-1">
            <select
              id="supervisor"
              name="supervisor"
              required
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            >
              <option value="">Select Supervisor</option>
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Project */}
    

      {/* Password */}
      <div>
        <div className="mt-1">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
            placeholder="Enter your password"
          />
        </div>
      </div>
           

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white  hover:bg-[#129777] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-[#117960]"
              >
               Register the user
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
               
              </div>
             
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterUser;
