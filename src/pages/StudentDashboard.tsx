  // MANUAL / AUTO SYNC FUNCTION
  const syncData = async () => {
    if (!isOnline) {
      alert("Walang internet. Hintayin bumalik ang connection.")
      return
    }
    
    const pendingItems = await db.syncQueue.where('status').equals('pending').toArray()
    if (pendingItems.length === 0) return
    
    setIsSyncing(true)

    for (const item of pendingItems) {
      try {
        if (item.action === 'TIME_IN') {
          
          // 1. Subukang i-save sa Supabase
          const { data, error } = await supabase.from('attendance').insert({
            lrn: item.payload.lrn,
            date: item.payload.date,
            time_in: item.payload.time,
            // time_in_photo: item.payload.photo_url  <-- Pansamantala nating tinatanggal muna ito para ma-test kung image ang problema
          }).select()

          // 2. Kung may error na iba sa "Duplicate", i-log natin at itapon ang error
          if (error && error.code !== '23505') {
            console.error("Supabase Insert Error:", error) 
            throw error
          }

          console.log("Successfully synced:", data)
        }
        
        // 3. BUBURAHIN LANG NATIN KUNG TALAGANG SUCCESSFUL ANG INSERT
        await db.syncQueue.delete(item.id!)
        
      } catch (err) {
        console.error("Sync failed for item", item.id, err)
        // Hindi natin buburahin dito. Maiiwan siya sa queue at magre-retry later.
      }
    }
    
    setIsSyncing(false)
    checkQueue()
  }
